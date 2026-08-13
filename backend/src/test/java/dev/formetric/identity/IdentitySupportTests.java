package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class IdentitySupportTests {

    @Test
    void normalizesEmailWithoutLocaleDependentCasing() {
        assertThat(IdentitySupport.normalizeEmail("  VITOR.RAMOS@Example.COM  "))
                .isEqualTo("vitor.ramos@example.com");
    }

    @Test
    void hashesInvitationTokensDeterministicallyWithoutPersistingTheToken() {
        String token = "invitation-token-visible-once";

        assertThat(IdentitySupport.hashToken(token))
                .hasSize(64)
                .isEqualTo(IdentitySupport.hashToken(token))
                .doesNotContain(token);
    }

    @Test
    void accountAndIpLimitsBlockIndependently() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-12T12:00:00Z"));
        LoginAttemptLimiter accountLimiter = limiter(clock, 3, 10, 100);

        for (int attempt = 0; attempt < 3; attempt++) {
            accountLimiter.checkAllowed("person@example.com", "192.0.2." + attempt);
            accountLimiter.recordFailure("person@example.com", "192.0.2." + attempt);
        }
        assertThatThrownBy(() -> accountLimiter.checkAllowed("person@example.com", "198.51.100.10"))
                .isInstanceOf(LoginRateLimitedException.class)
                .hasMessage("Muitas tentativas de login. Tente novamente mais tarde.");

        LoginAttemptLimiter ipLimiter = limiter(clock, 10, 4, 100);
        for (int attempt = 0; attempt < 4; attempt++) {
            String account = "person" + attempt + "@example.com";
            ipLimiter.checkAllowed(account, "203.0.113.20");
            ipLimiter.recordFailure(account, "203.0.113.20");
        }
        assertThatThrownBy(() -> ipLimiter.checkAllowed("unrelated@example.com", "203.0.113.20"))
                .isInstanceOf(LoginRateLimitedException.class)
                .hasMessage("Muitas tentativas de login. Tente novamente mais tarde.");
    }

    @Test
    void boundsTrackedKeysAndExpiresIdleEntriesByTtl() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-12T12:00:00Z"));
        LoginAttemptLimiter limiter = limiter(clock, 100, 100, 3);

        for (int attempt = 0; attempt < 6; attempt++) {
            limiter.recordFailure("person" + attempt + "@example.com", "192.0.2." + attempt);
        }

        assertThat(limiter.trackedAccountCount()).isEqualTo(3);
        assertThat(limiter.trackedIpCount()).isEqualTo(3);

        clock.advance(Duration.ofMinutes(11));
        assertThat(limiter.trackedAccountCount()).isZero();
        assertThat(limiter.trackedIpCount()).isZero();
    }

    @Test
    void rejectsRateLimitedLoginBeforeInvokingPasswordVerification() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-12T12:00:00Z"));
        LoginAttemptLimiter limiter = limiter(clock, 1, 10, 100);
        IdentityService identityService = mock(IdentityService.class);
        CurrentUserProvider currentUserProvider = mock(CurrentUserProvider.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(request.getRemoteAddr()).thenReturn("192.0.2.10");
        when(identityService.authenticate("person@example.com", "wrong-password"))
                .thenThrow(new InvalidCredentialsException());
        AuthenticationController controller =
                new AuthenticationController(identityService, currentUserProvider, limiter);
        LoginRequest login = new LoginRequest("person@example.com", "wrong-password");

        assertThatThrownBy(() -> controller.login(login, request, response))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("E-mail ou senha inválidos.");
        assertThatThrownBy(() -> controller.login(login, request, response))
                .isInstanceOf(LoginRateLimitedException.class)
                .hasMessage("Muitas tentativas de login. Tente novamente mais tarde.");

        verify(identityService, times(1)).authenticate("person@example.com", "wrong-password");
    }

    private static LoginAttemptLimiter limiter(
            Clock clock, int accountFailureLimit, int ipFailureLimit, int maxTrackedKeys) {
        return new LoginAttemptLimiter(
                clock,
                new LoginAttemptLimiter.Limits(
                        accountFailureLimit,
                        ipFailureLimit,
                        maxTrackedKeys,
                        Duration.ofMinutes(10)));
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        private void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}

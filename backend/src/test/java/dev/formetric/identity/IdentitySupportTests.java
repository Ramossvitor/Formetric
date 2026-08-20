package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.filter.ForwardedHeaderFilter;

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
    void ignoresForgedForwardedAddressesAndUsesOnlyTheUnderlyingTransportPeer() throws Exception {
        LoginRequestOriginResolver resolver = new LoginRequestOriginResolver(
                LoginRequestOriginResolver.Strategy.TRANSPORT_PEER);

        OriginObservation standardized = resolveThroughForwardedFilter(
                resolver, "Forwarded", "for=203.0.113.90;proto=https");
        OriginObservation legacy = resolveThroughForwardedFilter(
                resolver, "X-Forwarded-For", "198.51.100.77, 198.51.100.78");

        assertThat(standardized.decoratedRemoteAddress()).isEqualTo("203.0.113.90");
        assertThat(legacy.decoratedRemoteAddress()).isEqualTo("198.51.100.77");
        assertThat(standardized.rateLimitKey()).isEqualTo("transport-peer:10.0.0.8");
        assertThat(legacy.rateLimitKey()).isEqualTo("transport-peer:10.0.0.8");
    }

    @Test
    void accountAndTransportOriginLimitsBlockIndependently() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-12T12:00:00Z"));
        LoginAttemptLimiter accountLimiter = limiter(clock, 3, 10, 100);

        for (int attempt = 0; attempt < 3; attempt++) {
            accountLimiter.checkAllowed("person@example.com", "192.0.2." + attempt);
            accountLimiter.recordFailure("person@example.com", "192.0.2." + attempt);
        }
        assertThatThrownBy(() -> accountLimiter.checkAllowed("person@example.com", "198.51.100.10"))
                .isInstanceOf(LoginRateLimitedException.class)
                .hasMessage("Muitas tentativas de login. Tente novamente mais tarde.");

        LoginAttemptLimiter originLimiter = limiter(clock, 10, 4, 100);
        for (int attempt = 0; attempt < 4; attempt++) {
            String account = "person" + attempt + "@example.com";
            originLimiter.checkAllowed(account, "transport-peer:203.0.113.20");
            originLimiter.recordFailure(account, "transport-peer:203.0.113.20");
        }
        assertThatThrownBy(() -> originLimiter.checkAllowed(
                        "unrelated@example.com", "transport-peer:203.0.113.20"))
                .isInstanceOf(LoginRateLimitedException.class)
                .hasMessage("Muitas tentativas de login. Tente novamente mais tarde.");
    }

    @Test
    void globalLimitCannotBeBypassedByRotatingAccountsAndTransportOrigins() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-12T12:00:00Z"));
        LoginAttemptLimiter limiter = limiter(clock, 100, 100, 3, 100);

        for (int attempt = 0; attempt < 3; attempt++) {
            limiter.checkAllowed(
                    "person" + attempt + "@example.com",
                    "transport-peer:192.0.2." + attempt);
            limiter.recordFailure(
                    "person" + attempt + "@example.com",
                    "transport-peer:192.0.2." + attempt);
        }

        assertThatThrownBy(() -> limiter.checkAllowed(
                        "unrelated@example.com", "transport-peer:198.51.100.100"))
                .isInstanceOf(LoginRateLimitedException.class);
        assertThat(limiter.trackedGlobalCount()).isEqualTo(1);
    }

    @Test
    void boundsTrackedKeysAndExpiresIdleEntriesByTtl() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-12T12:00:00Z"));
        LoginAttemptLimiter limiter = limiter(clock, 100, 100, 3);

        for (int attempt = 0; attempt < 6; attempt++) {
            limiter.recordFailure("person" + attempt + "@example.com", "192.0.2." + attempt);
        }

        assertThat(limiter.trackedAccountCount()).isEqualTo(3);
        assertThat(limiter.trackedOriginCount()).isEqualTo(3);
        assertThat(limiter.trackedGlobalCount()).isEqualTo(1);

        clock.advance(Duration.ofMinutes(11));
        assertThat(limiter.trackedAccountCount()).isZero();
        assertThat(limiter.trackedOriginCount()).isZero();
        assertThat(limiter.trackedGlobalCount()).isZero();
    }

    @Test
    void rejectsRateLimitedLoginBeforeInvokingPasswordVerification() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-12T12:00:00Z"));
        LoginAttemptLimiter limiter = limiter(clock, 1, 10, 100);
        IdentityService identityService = mock(IdentityService.class);
        CurrentUserProvider currentUserProvider = mock(CurrentUserProvider.class);
        LoginRequestOriginResolver originResolver = mock(LoginRequestOriginResolver.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(originResolver.resolve(request)).thenReturn("transport-peer:192.0.2.10");
        when(identityService.authenticate("person@example.com", "wrong-password"))
                .thenThrow(new InvalidCredentialsException());
        AuthenticationController controller =
                new AuthenticationController(identityService, currentUserProvider, limiter, originResolver);
        LoginRequest login = new LoginRequest("person@example.com", "wrong-password");

        assertThatThrownBy(() -> controller.login(login, request, response))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("E-mail ou senha inválidos.");
        assertThatThrownBy(() -> controller.login(login, request, response))
                .isInstanceOf(LoginRateLimitedException.class)
                .hasMessage("Muitas tentativas de login. Tente novamente mais tarde.");

        verify(identityService, times(1)).authenticate("person@example.com", "wrong-password");
    }

    @Test
    void rejectsPasswordComputationImmediatelyWhenTheFairCapacityGateIsFull() throws Exception {
        PasswordComputationGate gate = new PasswordComputationGate(1, Duration.ZERO);
        CountDownLatch verificationStarted = new CountDownLatch(1);
        CountDownLatch releaseVerification = new CountDownLatch(1);

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var occupiedPermit = executor.submit(() -> gate.compute(() -> {
                verificationStarted.countDown();
                try {
                    return releaseVerification.await(2, TimeUnit.SECONDS);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    return false;
                }
            }));
            assertThat(verificationStarted.await(2, TimeUnit.SECONDS)).isTrue();

            assertThatThrownBy(() -> gate.compute(() -> true))
                    .isInstanceOf(PasswordComputationCapacityException.class)
                    .hasMessage("O processamento de senha est\u00e1 temporariamente ocupado. Tente novamente em instantes.");

            releaseVerification.countDown();
            assertThat(occupiedPermit.get(2, TimeUnit.SECONDS)).isTrue();
        } finally {
            releaseVerification.countDown();
        }

        assertThat(gate.availablePermits()).isEqualTo(1);
    }

    @Test
    void mapsPasswordComputationSaturationToRetryableProblemDetails() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/auth/login");

        var response = new IdentityExceptionHandler()
                .passwordComputationCapacity(new PasswordComputationCapacityException(), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("1");
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getType().toString())
                .isEqualTo("https://formetric.dev/problems/password-computation-capacity");
        assertThat(response.getBody().getProperties())
                .containsEntry("code", "PASSWORD_COMPUTATION_CAPACITY");
    }

    @Test
    void refreshesExpirationWithoutLeavingAnOldIndexEntry() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-12T12:00:00Z"));
        LoginAttemptLimiter limiter = limiter(clock, 100, 100, 3);

        limiter.recordFailure("person@example.com", "192.0.2.1");
        clock.advance(Duration.ofMinutes(5));
        limiter.recordFailure("person@example.com", "192.0.2.1");
        clock.advance(Duration.ofMinutes(6));

        assertThat(limiter.trackedAccountCount()).isEqualTo(1);
        assertThat(limiter.trackedOriginCount()).isEqualTo(1);
    }

    private static LoginAttemptLimiter limiter(
            Clock clock, int accountFailureLimit, int originFailureLimit, int maxTrackedKeys) {
        return limiter(clock, accountFailureLimit, originFailureLimit, 1_000, maxTrackedKeys);
    }

    private static LoginAttemptLimiter limiter(
            Clock clock,
            int accountFailureLimit,
            int originFailureLimit,
            int globalFailureLimit,
            int maxTrackedKeys) {
        return new LoginAttemptLimiter(
                clock,
                new LoginAttemptLimiter.Limits(
                        accountFailureLimit,
                        originFailureLimit,
                        globalFailureLimit,
                        maxTrackedKeys,
                        Duration.ofMinutes(10)));
    }

    private static OriginObservation resolveThroughForwardedFilter(
            LoginRequestOriginResolver resolver,
            String forwardedHeader,
            String forwardedValue) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0.8");
        request.addHeader(forwardedHeader, forwardedValue);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<OriginObservation> observation = new AtomicReference<>();

        new ForwardedHeaderFilter().doFilter(request, response, (decoratedRequest, ignoredResponse) -> {
            HttpServletRequest decorated = (HttpServletRequest) decoratedRequest;
            observation.set(new OriginObservation(
                    decorated.getRemoteAddr(),
                    resolver.resolve(new HttpServletRequestWrapper(decorated))));
        });

        return observation.get();
    }

    private record OriginObservation(String decoratedRemoteAddress, String rateLimitKey) {
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

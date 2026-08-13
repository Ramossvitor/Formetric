package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
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
    void progressivelyBlocksRepeatedLoginFailures() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter();
        Instant now = Instant.parse("2026-08-12T12:00:00Z");

        for (int attempt = 0; attempt < 5; attempt++) {
            limiter.checkAllowed("person@example.com|127.0.0.1", now);
            limiter.recordFailure("person@example.com|127.0.0.1", now);
        }

        assertThatThrownBy(() -> limiter.checkAllowed("person@example.com|127.0.0.1", now))
                .isInstanceOf(LoginRateLimitedException.class);
        limiter.checkAllowed("person@example.com|127.0.0.1", now.plusSeconds(31));
    }
}

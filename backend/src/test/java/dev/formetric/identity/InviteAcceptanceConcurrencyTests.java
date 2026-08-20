package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;

import dev.formetric.TestcontainersConfiguration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = {
        "formetric.bootstrap.admin-email=owner@formetric.dev",
        "formetric.bootstrap.admin-password=a-secure-owner-password",
        "formetric.bootstrap.admin-display-name=Formetric Owner"
})
class InviteAcceptanceConcurrencyTests {

    @Autowired
    private InviteAcceptanceTransactions inviteAcceptanceTransactions;

    @Autowired
    private JdbcClient jdbcClient;

    @Test
    void aLockedFinalRevalidationAllowsOnlyOneConcurrentAcceptance() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String email = "concurrent-invite-" + suffix + "@example.test";
        String tokenHash = IdentitySupport.hashToken("concurrent-token-" + suffix);
        Instant now = Instant.parse("2026-08-20T12:00:00Z");
        UUID creatorId = jdbcClient.sql("SELECT id FROM user_accounts WHERE email = 'owner@formetric.dev'")
                .query(UUID.class)
                .single();
        jdbcClient.sql("""
                        INSERT INTO user_invites
                            (id, email, role, token_hash, expires_at, created_by, created_at)
                        VALUES
                            (:id, :email, 'USER', :tokenHash, :expiresAt, :creatorId, :createdAt)
                        """)
                .param("id", UUID.randomUUID())
                .param("email", email)
                .param("tokenHash", tokenHash)
                .param("expiresAt", now.plusSeconds(3600).atOffset(ZoneOffset.UTC))
                .param("creatorId", creatorId)
                .param("createdAt", now.atOffset(ZoneOffset.UTC))
                .update();

        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> acceptAfter(start, tokenHash, now));
            var second = executor.submit(() -> acceptAfter(start, tokenHash, now));
            start.countDown();

            assertThat(java.util.List.of(
                            first.get(5, TimeUnit.SECONDS),
                            second.get(5, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(AcceptanceResult.ACCEPTED, AcceptanceResult.REJECTED_AS_USED);
            assertThat(jdbcClient.sql("SELECT COUNT(*) FROM user_accounts WHERE email = :email")
                            .param("email", email)
                            .query(Long.class)
                            .single())
                    .isEqualTo(1);
        } finally {
            jdbcClient.sql("DELETE FROM user_invites WHERE token_hash = :tokenHash")
                    .param("tokenHash", tokenHash)
                    .update();
            jdbcClient.sql("DELETE FROM user_accounts WHERE email = :email")
                    .param("email", email)
                    .update();
        }
    }

    private AcceptanceResult acceptAfter(CountDownLatch start, String tokenHash, Instant now) throws Exception {
        start.await(2, TimeUnit.SECONDS);
        try {
            inviteAcceptanceTransactions.complete(
                    tokenHash,
                    "Pessoa Concorrente",
                    "$argon2id$v=19$m=16384,t=2,p=1$test$test",
                    now);
            return AcceptanceResult.ACCEPTED;
        } catch (InvalidInviteException exception) {
            assertThat(exception).hasMessage("Este convite já foi utilizado.");
            return AcceptanceResult.REJECTED_AS_USED;
        }
    }

    private enum AcceptanceResult {
        ACCEPTED,
        REJECTED_AS_USED
    }
}

package dev.formetric.identity;

import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Loads only the identity fields required to revalidate an existing authenticated session.
 *
 * <p>The lookup key always comes from the server-side principal. It does not accept an email or
 * tenant identifier supplied by the request, which keeps the revalidation lookup scoped to the
 * account that originally established the session.</p>
 */
@Component
class AuthenticatedSessionIdentityProvider {

    private final JdbcClient jdbcClient;

    AuthenticatedSessionIdentityProvider(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    Optional<SessionIdentity> findById(UUID accountId) {
        return jdbcClient.sql("""
                        SELECT account.id,
                               account.email,
                               account.role,
                               account.status,
                               profile.display_name
                          FROM user_accounts account
                          JOIN user_profiles profile ON profile.user_id = account.id
                         WHERE account.id = :accountId
                        """)
                .param("accountId", accountId)
                .query((resultSet, rowNumber) -> new SessionIdentity(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("email"),
                        resultSet.getString("display_name"),
                        UserRole.valueOf(resultSet.getString("role")),
                        AccountStatus.valueOf(resultSet.getString("status"))))
                .optional();
    }

    record SessionIdentity(
            UUID id,
            String email,
            String displayName,
            UserRole role,
            AccountStatus status) {

        boolean isActive() {
            return status == AccountStatus.ACTIVE;
        }

        AuthenticatedUser toPrincipal() {
            return new AuthenticatedUser(id, email, displayName, role);
        }
    }
}

package dev.formetric.identity;

import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opens only the short read transactions needed around login database access.
 * Password hashing deliberately happens in {@link IdentityService}, after the first
 * method has returned and before the second method starts.
 */
@Component
class LoginAccountSnapshots {

    private final UserAccountRepository accounts;

    LoginAccountSnapshots(UserAccountRepository accounts) {
        this.accounts = accounts;
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Optional<LoginCredentialSnapshot> credentialFor(String normalizedEmail) {
        return accounts.findLoginCredentialByEmail(normalizedEmail).map(LoginCredentialSnapshot::from);
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Optional<CurrentLoginSnapshot> currentFor(UUID accountId) {
        return accounts.findCurrentLoginById(accountId).map(CurrentLoginSnapshot::from);
    }
}

record LoginCredentialSnapshot(UUID id, String email, String passwordHash, AccountStatus status) {

    static LoginCredentialSnapshot from(LoginCredentialProjection projection) {
        return new LoginCredentialSnapshot(
                projection.getId(),
                projection.getEmail(),
                projection.getPasswordHash(),
                projection.getStatus());
    }
}

record CurrentLoginSnapshot(
        UUID id,
        String email,
        String passwordHash,
        AccountStatus status,
        UserRole role,
        String displayName) {

    static CurrentLoginSnapshot from(CurrentLoginProjection projection) {
        return new CurrentLoginSnapshot(
                projection.getId(),
                projection.getEmail(),
                projection.getPasswordHash(),
                projection.getStatus(),
                projection.getRole(),
                projection.getDisplayName());
    }

    AuthenticatedUser authenticatedUser() {
        return new AuthenticatedUser(id, email, displayName, role);
    }
}

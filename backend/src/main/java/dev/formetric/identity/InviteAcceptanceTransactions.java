package dev.formetric.identity;

import java.time.Instant;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Keeps database work around invitation acceptance short and separate from password hashing. */
@Component
class InviteAcceptanceTransactions {

    private final UserAccountRepository accounts;
    private final UserProfileRepository profiles;
    private final UserInviteRepository invites;

    InviteAcceptanceTransactions(
            UserAccountRepository accounts,
            UserProfileRepository profiles,
            UserInviteRepository invites) {
        this.accounts = accounts;
        this.profiles = profiles;
        this.invites = invites;
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Optional<InviteAcceptanceCandidate> candidateFor(String tokenHash) {
        return invites.findByTokenHash(tokenHash).map(InviteAcceptanceCandidate::from);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AuthenticatedUser complete(
            String tokenHash,
            String displayName,
            String passwordHash,
            Instant now) {
        UserInvite invite = invites.findByTokenHashForUpdate(tokenHash)
                .orElseThrow(() -> new InvalidInviteException("Convite inválido."));
        requireUsable(invite.isAccepted(), invite.isExpired(now));
        if (accounts.existsByEmail(invite.email())) {
            throw new IdentityConflictException("Já existe uma conta para este e-mail.");
        }

        UserAccount account = UserAccount.create(invite.email(), passwordHash, invite.role(), now);
        UserProfile profile = UserProfile.defaults(account.id(), displayName, now);
        try {
            accounts.saveAndFlush(account);
            profiles.save(profile);
            invite.accept(account.id(), now);
            invites.saveAndFlush(invite);
        } catch (DataIntegrityViolationException exception) {
            throw new IdentityConflictException("Não foi possível criar a conta para este convite.");
        }
        return new AuthenticatedUser(account.id(), account.email(), profile.displayName(), account.role());
    }

    private static void requireUsable(boolean accepted, boolean expired) {
        if (accepted) {
            throw new InvalidInviteException("Este convite já foi utilizado.");
        }
        if (expired) {
            throw new InvalidInviteException("Este convite expirou.");
        }
    }
}

record InviteAcceptanceCandidate(
        String email,
        UserRole role,
        Instant expiresAt,
        Instant acceptedAt) {

    static InviteAcceptanceCandidate from(UserInvite invite) {
        return new InviteAcceptanceCandidate(
                invite.email(), invite.role(), invite.expiresAt(), invite.acceptedAt());
    }

    void requireUsable(Instant now) {
        if (acceptedAt != null) {
            throw new InvalidInviteException("Este convite já foi utilizado.");
        }
        if (!expiresAt.isAfter(now)) {
            throw new InvalidInviteException("Este convite expirou.");
        }
    }
}

package dev.formetric.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_invites")
class UserInvite {

    @Id
    private UUID id;

    @Column(nullable = false, length = 320)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserRole role;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "accepted_by")
    private UUID acceptedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected UserInvite() {
    }

    private UserInvite(
            UUID id,
            String email,
            UserRole role,
            String tokenHash,
            Instant expiresAt,
            UUID createdBy,
            Instant now) {
        this.id = id;
        this.email = email;
        this.role = role;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdBy = createdBy;
        this.createdAt = now;
    }

    static UserInvite create(
            String normalizedEmail,
            UserRole role,
            String tokenHash,
            Instant expiresAt,
            UUID createdBy,
            Instant now) {
        return new UserInvite(UUID.randomUUID(), normalizedEmail, role, tokenHash, expiresAt, createdBy, now);
    }

    boolean isExpired(Instant now) {
        return !expiresAt.isAfter(now);
    }

    boolean isAccepted() {
        return acceptedAt != null;
    }

    void accept(UUID userId, Instant now) {
        this.acceptedBy = userId;
        this.acceptedAt = now;
    }

    UUID id() {
        return id;
    }

    String email() {
        return email;
    }

    UserRole role() {
        return role;
    }

    Instant expiresAt() {
        return expiresAt;
    }

    Instant acceptedAt() {
        return acceptedAt;
    }

    UUID createdBy() {
        return createdBy;
    }
}

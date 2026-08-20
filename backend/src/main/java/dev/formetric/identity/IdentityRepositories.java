package dev.formetric.identity;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {

    Optional<UserAccount> findByEmail(String email);

    @Query("""
            select account.id as id,
                   account.email as email,
                   account.passwordHash as passwordHash,
                   account.status as status
              from UserAccount account
             where account.email = :email
            """)
    Optional<LoginCredentialProjection> findLoginCredentialByEmail(@Param("email") String email);

    @Query("""
            select account.id as id,
                   account.email as email,
                   account.passwordHash as passwordHash,
                   account.status as status,
                   account.role as role,
                   profile.displayName as displayName
              from UserAccount account
              join UserProfile profile on profile.userId = account.id
             where account.id = :id
            """)
    Optional<CurrentLoginProjection> findCurrentLoginById(@Param("id") UUID id);

    boolean existsByEmail(String email);

    Optional<UserAccount> findFirstByRole(UserRole role);
}

interface UserProfileRepository extends JpaRepository<UserProfile, UUID> {
}

interface LoginCredentialProjection {

    UUID getId();

    String getEmail();

    String getPasswordHash();

    AccountStatus getStatus();
}

interface CurrentLoginProjection extends LoginCredentialProjection {

    UserRole getRole();

    String getDisplayName();
}

interface UserInviteRepository extends JpaRepository<UserInvite, UUID> {

    Optional<UserInvite> findByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select invite from UserInvite invite where invite.tokenHash = :tokenHash")
    Optional<UserInvite> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);
}

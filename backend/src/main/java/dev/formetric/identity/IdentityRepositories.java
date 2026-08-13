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

    boolean existsByEmail(String email);

    Optional<UserAccount> findFirstByRole(UserRole role);
}

interface UserProfileRepository extends JpaRepository<UserProfile, UUID> {
}

interface UserInviteRepository extends JpaRepository<UserInvite, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select invite from UserInvite invite where invite.tokenHash = :tokenHash")
    Optional<UserInvite> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);
}

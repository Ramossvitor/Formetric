package dev.formetric.diary;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.LockModeType;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface DailyLogRepository extends JpaRepository<DailyLog, UUID> {
    Optional<DailyLog> findByUserIdAndDate(UUID userId, LocalDate date);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select log from DailyLog log where log.userId = :userId and log.date = :date")
    Optional<DailyLog> findForUpdate(@Param("userId") UUID userId, @Param("date") LocalDate date);
}

interface DiaryIdempotencyRepository extends JpaRepository<DiaryIdempotencyKey, DiaryIdempotencyId> {
}

@Entity
@Table(name = "diary_idempotency_keys")
class DiaryIdempotencyKey {
    @EmbeddedId private DiaryIdempotencyId id;
    @Column(nullable = false, length = 32) private String operation;
    @Column(name = "log_date", nullable = false) private LocalDate logDate;
    @Column(name = "payload_fingerprint", nullable = false, length = 64) private String payloadFingerprint;
    @Column(name = "resource_id") private UUID resourceId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected DiaryIdempotencyKey() {}
    DiaryIdempotencyKey(
            UUID userId,
            UUID requestId,
            String operation,
            LocalDate logDate,
            String payloadFingerprint,
            UUID resourceId,
            Instant at) {
        this.id = new DiaryIdempotencyId(userId, requestId); this.operation = operation;
        this.logDate = logDate; this.payloadFingerprint = payloadFingerprint;
        this.resourceId = resourceId; this.createdAt = at;
    }
    String operation() { return operation; }
    LocalDate logDate() { return logDate; }
    String payloadFingerprint() { return payloadFingerprint; }
    UUID resourceId() { return resourceId; }
}

@Embeddable
class DiaryIdempotencyId implements Serializable {
    @Column(name = "user_id") private UUID userId;
    @Column(name = "request_id") private UUID requestId;

    protected DiaryIdempotencyId() {}

    DiaryIdempotencyId(UUID userId, UUID requestId) {
        this.userId = userId;
        this.requestId = requestId;
    }

    @Override
    public boolean equals(Object other) {
        return this == other
                || other instanceof DiaryIdempotencyId that
                && java.util.Objects.equals(userId, that.userId)
                && java.util.Objects.equals(requestId, that.requestId);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(userId, requestId);
    }
}

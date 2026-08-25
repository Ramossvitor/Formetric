package dev.formetric.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

interface WorkoutRepository extends JpaRepository<Workout, UUID> {

    @EntityGraph(attributePaths = "muscleGroups")
    List<Workout> findAllByUserIdAndDateBetweenOrderByDateAscStartTimeAscIdAsc(
            UUID userId, LocalDate from, LocalDate to);

    @EntityGraph(attributePaths = "muscleGroups")
    Optional<Workout> findByIdAndUserId(UUID id, UUID userId);
}

interface WeightLogRepository extends JpaRepository<WeightLog, UUID> {

    List<WeightLog> findAllByUserIdAndDateBetweenOrderByDateAscMeasuredAtAsc(
            UUID userId, LocalDate from, LocalDate to);

    Optional<WeightLog> findByUserIdAndDate(UUID userId, LocalDate date);
}

interface WorkoutIdempotencyRepository
        extends JpaRepository<WorkoutIdempotencyKey, WorkoutIdempotencyId> {
}

@Entity
@Table(name = "workout_idempotency_keys")
class WorkoutIdempotencyKey {

    @EmbeddedId
    private WorkoutIdempotencyId id;

    @Column(name = "payload_fingerprint", nullable = false, length = 64)
    private String payloadFingerprint;

    @Column(name = "resource_id")
    private UUID resourceId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected WorkoutIdempotencyKey() {
    }

    WorkoutIdempotencyKey(
            UUID userId,
            UUID requestId,
            String payloadFingerprint,
            UUID resourceId,
            Instant createdAt) {
        this.id = new WorkoutIdempotencyId(userId, requestId);
        this.payloadFingerprint = payloadFingerprint;
        this.resourceId = resourceId;
        this.createdAt = createdAt;
    }

    String payloadFingerprint() { return payloadFingerprint; }
    UUID resourceId() { return resourceId; }
}

@Embeddable
class WorkoutIdempotencyId implements Serializable {

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "request_id")
    private UUID requestId;

    protected WorkoutIdempotencyId() {
    }

    WorkoutIdempotencyId(UUID userId, UUID requestId) {
        this.userId = userId;
        this.requestId = requestId;
    }

    @Override
    public boolean equals(Object other) {
        return this == other
                || other instanceof WorkoutIdempotencyId that
                && Objects.equals(userId, that.userId)
                && Objects.equals(requestId, that.requestId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, requestId);
    }
}

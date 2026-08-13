package dev.formetric.activity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.OptimisticLock;

@Entity
@Table(name = "workouts")
class Workout {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "activity_date", nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private WorkoutModality modality;

    @Column(name = "custom_modality", length = 80)
    private String customModality;

    @Column(nullable = false, length = 120)
    private String title;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "workout_muscle_groups", joinColumns = @JoinColumn(name = "workout_id"))
    @OrderColumn(name = "position")
    @Column(name = "muscle_group", nullable = false, length = 50)
    @OptimisticLock(excluded = true)
    private List<String> muscleGroups = new ArrayList<>();

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Column(name = "estimated_kcal", precision = 12, scale = 3)
    private BigDecimal estimatedKcal;

    @Column(length = 2000)
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected Workout() {
    }

    private Workout(UUID userId, WorkoutDetails details, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        apply(details);
        this.createdAt = now;
        this.updatedAt = now;
    }

    static Workout create(UUID userId, WorkoutDetails details, Instant now) {
        WorkoutRules.validate(details);
        return new Workout(userId, details, now);
    }

    void update(WorkoutDetails details, long expectedVersion, Instant now) {
        if (version != expectedVersion) {
            throw new ActivityConflictException("O treino foi alterado por outra operação. Atualize os dados e tente novamente.");
        }
        WorkoutRules.validate(details);
        apply(details);
        updatedAt = now;
    }

    private void apply(WorkoutDetails details) {
        this.date = details.date();
        this.modality = details.modality();
        this.customModality = WorkoutRules.optionalTrimmed(details.customModality());
        this.title = details.title().trim();
        this.muscleGroups.clear();
        this.muscleGroups.addAll(WorkoutRules.normalizeMuscleGroups(details.muscleGroups()));
        this.startTime = details.startTime();
        this.durationMinutes = details.durationMinutes();
        this.estimatedKcal = details.estimatedKcal() == null
                ? null
                : details.estimatedKcal().setScale(3, RoundingMode.HALF_UP);
        this.notes = WorkoutRules.optionalPreservingWhitespace(details.notes());
    }

    UUID id() { return id; }
    UUID userId() { return userId; }
    LocalDate date() { return date; }
    WorkoutModality modality() { return modality; }
    String customModality() { return customModality; }
    String title() { return title; }
    List<String> muscleGroups() { return List.copyOf(muscleGroups); }
    LocalTime startTime() { return startTime; }
    int durationMinutes() { return durationMinutes; }
    BigDecimal estimatedKcal() { return estimatedKcal; }
    String notes() { return notes; }
    Instant createdAt() { return createdAt; }
    Instant updatedAt() { return updatedAt; }
    long version() { return version; }
}

record WorkoutDetails(
        LocalDate date,
        WorkoutModality modality,
        String customModality,
        String title,
        List<String> muscleGroups,
        LocalTime startTime,
        int durationMinutes,
        BigDecimal estimatedKcal,
        String notes) {
}

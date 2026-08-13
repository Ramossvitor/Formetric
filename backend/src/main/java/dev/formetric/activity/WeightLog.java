package dev.formetric.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "weight_logs")
class WeightLog {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "measurement_date", nullable = false)
    private LocalDate date;

    @Column(name = "weight_kg", nullable = false, precision = 7, scale = 3)
    private BigDecimal weightKg;

    @Column(name = "measured_at", nullable = false)
    private LocalTime measuredAt;

    @Column(name = "measurement_condition", length = 120)
    private String condition;

    @Column(length = 2000)
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected WeightLog() {
    }

    private WeightLog(UUID userId, LocalDate date, WeightDetails details, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.date = date;
        apply(details);
        this.createdAt = now;
        this.updatedAt = now;
    }

    static WeightLog create(UUID userId, LocalDate date, WeightDetails details, Instant now) {
        WeightRules.validate(details);
        return new WeightLog(userId, date, details, now);
    }

    void update(WeightDetails details, long expectedVersion, Instant now) {
        if (version != expectedVersion) {
            throw new ActivityConflictException("A pesagem foi alterada por outra operação. Atualize os dados e tente novamente.");
        }
        WeightRules.validate(details);
        apply(details);
        updatedAt = now;
    }

    private void apply(WeightDetails details) {
        this.weightKg = details.weightKg().setScale(3, RoundingMode.HALF_UP);
        this.measuredAt = details.measuredAt();
        this.condition = WorkoutRules.optionalTrimmed(details.condition());
        this.notes = WorkoutRules.optionalPreservingWhitespace(details.notes());
    }

    UUID id() { return id; }
    UUID userId() { return userId; }
    LocalDate date() { return date; }
    BigDecimal weightKg() { return weightKg; }
    LocalTime measuredAt() { return measuredAt; }
    String condition() { return condition; }
    String notes() { return notes; }
    Instant createdAt() { return createdAt; }
    Instant updatedAt() { return updatedAt; }
    long version() { return version; }
}

record WeightDetails(BigDecimal weightKg, LocalTime measuredAt, String condition, String notes) {
}

package dev.formetric.planning;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "tdee_periods")
class TdeePeriod {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    @Column(name = "kcal_per_day", nullable = false, precision = 12, scale = 3)
    private BigDecimal kcalPerDay;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TdeePeriod() {
    }

    private TdeePeriod(
            UUID id,
            UUID userId,
            LocalDate validFrom,
            LocalDate validTo,
            BigDecimal kcalPerDay,
            Instant now) {
        this.id = id;
        this.userId = userId;
        this.validFrom = validFrom;
        this.validTo = validTo;
        this.kcalPerDay = kcalPerDay;
        this.createdAt = now;
        this.updatedAt = now;
    }

    static TdeePeriod create(
            UUID userId,
            LocalDate validFrom,
            LocalDate validTo,
            BigDecimal kcalPerDay,
            Instant now) {
        return new TdeePeriod(UUID.randomUUID(), userId, validFrom, validTo, kcalPerDay, now);
    }

    void closeAt(LocalDate nextValidFrom, Instant now) {
        if (validTo != null) {
            throw new IllegalStateException("Only an open TDEE period can be closed");
        }
        if (!nextValidFrom.isAfter(validFrom)) {
            throw new IllegalStateException("The closing date must be after the period start");
        }
        validTo = nextValidFrom;
        updatedAt = now;
    }

    UUID id() {
        return id;
    }

    LocalDate validFrom() {
        return validFrom;
    }

    LocalDate validTo() {
        return validTo;
    }

    BigDecimal kcalPerDay() {
        return kcalPerDay;
    }

    Instant createdAt() {
        return createdAt;
    }

    Instant updatedAt() {
        return updatedAt;
    }
}

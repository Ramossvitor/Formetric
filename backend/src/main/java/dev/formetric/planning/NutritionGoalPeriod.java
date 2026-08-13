package dev.formetric.planning;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "nutrition_goal_periods")
class NutritionGoalPeriod {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    @Column(name = "calorie_target", precision = 12, scale = 3)
    private BigDecimal calorieTarget;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "goalPeriod", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("nutrient ASC")
    private List<NutrientTarget> nutrientTargets = new ArrayList<>();

    protected NutritionGoalPeriod() {
    }

    private NutritionGoalPeriod(
            UUID id,
            UUID userId,
            LocalDate validFrom,
            LocalDate validTo,
            BigDecimal calorieTarget,
            Instant now) {
        this.id = id;
        this.userId = userId;
        this.validFrom = validFrom;
        this.validTo = validTo;
        this.calorieTarget = calorieTarget;
        this.createdAt = now;
        this.updatedAt = now;
    }

    static NutritionGoalPeriod create(
            UUID userId,
            LocalDate validFrom,
            LocalDate validTo,
            BigDecimal calorieTarget,
            List<NutrientTargetDefinition> targets,
            Instant now) {
        NutritionGoalPeriod period = new NutritionGoalPeriod(
                UUID.randomUUID(), userId, validFrom, validTo, calorieTarget, now);
        targets.forEach(target -> period.nutrientTargets.add(NutrientTarget.create(period, target)));
        return period;
    }

    void closeAt(LocalDate nextValidFrom, Instant now) {
        if (validTo != null) {
            throw new IllegalStateException("Only an open nutrition goal period can be closed");
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

    BigDecimal calorieTarget() {
        return calorieTarget;
    }

    Instant createdAt() {
        return createdAt;
    }

    Instant updatedAt() {
        return updatedAt;
    }

    List<NutrientTarget> nutrientTargets() {
        return List.copyOf(nutrientTargets);
    }
}

@Entity
@Table(name = "nutrient_targets")
class NutrientTarget {

    @Id
    private UUID id;

    @jakarta.persistence.ManyToOne(fetch = FetchType.LAZY, optional = false)
    @jakarta.persistence.JoinColumn(name = "goal_period_id", nullable = false)
    private NutritionGoalPeriod goalPeriod;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(nullable = false, length = 24)
    private NutrientType nutrient;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(nullable = false, length = 8)
    private NutritionUnit unit;

    @OneToMany(mappedBy = "nutrientTarget", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("position ASC")
    private List<GoalBand> bands = new ArrayList<>();

    protected NutrientTarget() {
    }

    private NutrientTarget(UUID id, NutritionGoalPeriod goalPeriod, NutrientType nutrient, NutritionUnit unit) {
        this.id = id;
        this.goalPeriod = goalPeriod;
        this.nutrient = nutrient;
        this.unit = unit;
    }

    static NutrientTarget create(NutritionGoalPeriod period, NutrientTargetDefinition definition) {
        NutrientTarget target = new NutrientTarget(
                UUID.randomUUID(), period, definition.nutrient(), definition.unit());
        definition.bands().forEach(band -> target.bands.add(GoalBand.create(target, band)));
        return target;
    }

    NutrientType nutrient() {
        return nutrient;
    }

    NutritionUnit unit() {
        return unit;
    }

    List<GoalBand> bands() {
        return List.copyOf(bands);
    }
}

@Entity
@Table(name = "goal_bands")
class GoalBand {

    @Id
    private UUID id;

    @jakarta.persistence.ManyToOne(fetch = FetchType.LAZY, optional = false)
    @jakarta.persistence.JoinColumn(name = "nutrient_target_id", nullable = false)
    private NutrientTarget nutrientTarget;

    @Column(name = "band_order", nullable = false)
    private int position;

    @Column(name = "min_value", precision = 12, scale = 3)
    private BigDecimal minimum;

    @Column(name = "max_value", precision = 12, scale = 3)
    private BigDecimal maximum;

    @Column(name = "min_inclusive", nullable = false)
    private boolean minimumInclusive;

    @Column(name = "max_inclusive", nullable = false)
    private boolean maximumInclusive;

    @Column(nullable = false, length = 40)
    private String label;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(nullable = false, length = 16)
    private GoalTone tone;

    protected GoalBand() {
    }

    private GoalBand(
            UUID id,
            NutrientTarget nutrientTarget,
            int position,
            BigDecimal minimum,
            BigDecimal maximum,
            boolean minimumInclusive,
            boolean maximumInclusive,
            String label,
            GoalTone tone) {
        this.id = id;
        this.nutrientTarget = nutrientTarget;
        this.position = position;
        this.minimum = minimum;
        this.maximum = maximum;
        this.minimumInclusive = minimumInclusive;
        this.maximumInclusive = maximumInclusive;
        this.label = label;
        this.tone = tone;
    }

    static GoalBand create(NutrientTarget target, GoalBandDefinition definition) {
        return new GoalBand(
                UUID.randomUUID(),
                target,
                definition.position(),
                definition.minimum(),
                definition.maximum(),
                definition.minimumInclusive(),
                definition.maximumInclusive(),
                definition.label(),
                definition.tone());
    }

    BigDecimal minimum() {
        return minimum;
    }

    int position() {
        return position;
    }

    BigDecimal maximum() {
        return maximum;
    }

    boolean minimumInclusive() {
        return minimumInclusive;
    }

    boolean maximumInclusive() {
        return maximumInclusive;
    }

    String label() {
        return label;
    }

    GoalTone tone() {
        return tone;
    }
}

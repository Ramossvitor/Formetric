package dev.formetric.planning;

import dev.formetric.identity.CurrentUserProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Read-only planning API for modules that calculate date-sensitive results. */
@Component
public class PlanningDataProvider {

    private final TdeePeriodRepository tdeePeriods;
    private final NutritionGoalPeriodRepository goalPeriods;
    private final NutrientTargetRepository nutrientTargets;
    private final CurrentUserProvider currentUserProvider;

    PlanningDataProvider(
            TdeePeriodRepository tdeePeriods,
            NutritionGoalPeriodRepository goalPeriods,
            NutrientTargetRepository nutrientTargets,
            CurrentUserProvider currentUserProvider) {
        this.tdeePeriods = tdeePeriods;
        this.goalPeriods = goalPeriods;
        this.nutrientTargets = nutrientTargets;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public Optional<BigDecimal> effectiveTdeeKcal(LocalDate date) {
        var userId = currentUserProvider.requireCurrentUser().id();
        return tdeePeriods.findEffective(userId, date).map(TdeePeriod::kcalPerDay);
    }

    @Transactional(readOnly = true)
    public Optional<EffectiveNutritionGoals> effectiveNutritionGoals(LocalDate date) {
        var userId = currentUserProvider.requireCurrentUser().id();
        return goalPeriods.findEffective(userId, date).map(PlanningDataProvider::toGoals);
    }

    /** Loads the versioned planning windows once for a bounded analytics interval. */
    @Transactional(readOnly = true)
    public PlanningTimeline timeline(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("A valid planning timeline interval is required");
        }
        var userId = currentUserProvider.requireCurrentUser().id();
        List<EffectiveTdeePeriod> tdeeTimeline = tdeePeriods.findOverlapping(userId, from, to).stream()
                .map(period -> new EffectiveTdeePeriod(
                        period.id(), period.validFrom(), period.validTo(), period.kcalPerDay()))
                .toList();
        List<NutritionGoalPeriod> overlappingGoals = goalPeriods.findOverlappingWithTargets(userId, from, to);
        if (!overlappingGoals.isEmpty()) {
            nutrientTargets.fetchBandsForPeriods(overlappingGoals);
        }
        List<EffectiveNutritionGoals> goalTimeline = overlappingGoals.stream()
                .map(PlanningDataProvider::toGoals)
                .toList();
        return new PlanningTimeline(tdeeTimeline, goalTimeline);
    }

    private static EffectiveNutritionGoals toGoals(NutritionGoalPeriod period) {
        return new EffectiveNutritionGoals(
                period.id(),
                period.validFrom(),
                period.validTo(),
                period.calorieTarget(),
                period.nutrientTargets().stream()
                        .map(target -> new EffectiveNutrientTarget(
                                target.nutrient(),
                                target.unit(),
                                target.bands().stream()
                                        .map(band -> new EffectiveGoalBand(
                                                band.position(),
                                                band.minimum(),
                                                band.maximum(),
                                                band.minimumInclusive(),
                                                band.maximumInclusive(),
                                                band.label(),
                                                band.tone(),
                                                band.countsAsAttained()))
                                        .toList()))
                        .toList());
    }

    public record EffectiveNutritionGoals(
            java.util.UUID id,
            LocalDate validFrom,
            LocalDate validTo,
            BigDecimal calorieTarget,
            List<EffectiveNutrientTarget> targets) {
    }

    public record EffectiveTdeePeriod(
            java.util.UUID id,
            LocalDate validFrom,
            LocalDate validTo,
            BigDecimal kcalPerDay) {
        public boolean contains(LocalDate date) {
            return !date.isBefore(validFrom) && (validTo == null || date.isBefore(validTo));
        }
    }

    public record PlanningTimeline(
            List<EffectiveTdeePeriod> tdeePeriods,
            List<EffectiveNutritionGoals> nutritionGoalPeriods) {

        public Optional<BigDecimal> effectiveTdeeKcal(LocalDate date) {
            return tdeePeriods.stream()
                    .filter(period -> period.contains(date))
                    .map(EffectiveTdeePeriod::kcalPerDay)
                    .findFirst();
        }

        public Optional<EffectiveNutritionGoals> effectiveNutritionGoals(LocalDate date) {
            return nutritionGoalPeriods.stream()
                    .filter(period -> !date.isBefore(period.validFrom())
                            && (period.validTo() == null || date.isBefore(period.validTo())))
                    .findFirst();
        }
    }

    public record EffectiveNutrientTarget(
            NutrientType nutrient,
            NutritionUnit unit,
            List<EffectiveGoalBand> bands) {
    }

    public record EffectiveGoalBand(
            int position,
            BigDecimal minValue,
            BigDecimal maxValue,
            boolean minInclusive,
            boolean maxInclusive,
            String label,
            GoalTone tone,
            boolean countsAsAttained) {
    }
}

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
    private final CurrentUserProvider currentUserProvider;

    PlanningDataProvider(
            TdeePeriodRepository tdeePeriods,
            NutritionGoalPeriodRepository goalPeriods,
            CurrentUserProvider currentUserProvider) {
        this.tdeePeriods = tdeePeriods;
        this.goalPeriods = goalPeriods;
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
        return goalPeriods.findEffective(userId, date).map(period -> new EffectiveNutritionGoals(
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
                                                band.tone()))
                                        .toList()))
                        .toList()));
    }

    public record EffectiveNutritionGoals(
            java.util.UUID id,
            LocalDate validFrom,
            LocalDate validTo,
            BigDecimal calorieTarget,
            List<EffectiveNutrientTarget> targets) {
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
            GoalTone tone) {
    }
}

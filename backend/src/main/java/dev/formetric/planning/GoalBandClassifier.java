package dev.formetric.planning;

import dev.formetric.planning.PlanningDataProvider.EffectiveGoalBand;
import dev.formetric.planning.PlanningDataProvider.EffectiveNutrientTarget;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/** Pure deterministic classification of a value against one versioned nutrition target. */
public final class GoalBandClassifier {

    private GoalBandClassifier() {
    }

    public static GoalClassification classify(EffectiveNutrientTarget target, BigDecimal value) {
        Objects.requireNonNull(target, "target");
        List<EffectiveGoalBand> ordered = target.bands().stream()
                .sorted(Comparator.comparingInt(EffectiveGoalBand::position))
                .toList();
        EffectiveGoalBand matched = value == null
                ? null
                : ordered.stream().filter(band -> contains(band, value)).findFirst().orElse(null);
        EffectiveGoalBand reference = referenceBand(ordered, value);

        return new GoalClassification(
                target.nutrient(),
                target.unit(),
                value,
                matched == null ? null : matched.label(),
                matched == null ? null : matched.tone(),
                value == null ? null : matched != null && matched.countsAsAttained(),
                toReference(reference, value));
    }

    private static EffectiveGoalBand referenceBand(List<EffectiveGoalBand> ordered, BigDecimal value) {
        List<EffectiveGoalBand> attained = ordered.stream()
                .filter(EffectiveGoalBand::countsAsAttained)
                .toList();
        if (value == null) {
            return attained.stream().findFirst().orElse(null);
        }
        return attained.stream()
                .filter(band -> contains(band, value))
                .findFirst()
                .orElseGet(() -> attained.stream()
                        .min(Comparator.comparing((EffectiveGoalBand band) -> distanceToRange(band, value))
                                .thenComparingInt(EffectiveGoalBand::position))
                        .orElse(null));
    }

    private static GoalReference toReference(EffectiveGoalBand band, BigDecimal value) {
        if (band == null) {
            return null;
        }
        BigDecimal remaining = null;
        BigDecimal excess = null;
        BigDecimal distance = null;
        if (value != null) {
            distance = distanceToRange(band, value);
            if (isBelow(band, value)) {
                remaining = band.minValue().subtract(value);
            } else if (isAbove(band, value)) {
                excess = value.subtract(band.maxValue());
            }
        }
        return new GoalReference(
                band.label(),
                band.minValue(),
                band.maxValue(),
                band.minInclusive(),
                band.maxInclusive(),
                remaining,
                excess,
                distance);
    }

    private static boolean contains(EffectiveGoalBand band, BigDecimal value) {
        return !isBelow(band, value) && !isAbove(band, value);
    }

    private static boolean isBelow(EffectiveGoalBand band, BigDecimal value) {
        return band.minValue() != null
                && (value.compareTo(band.minValue()) < 0
                        || value.compareTo(band.minValue()) == 0 && !band.minInclusive());
    }

    private static boolean isAbove(EffectiveGoalBand band, BigDecimal value) {
        return band.maxValue() != null
                && (value.compareTo(band.maxValue()) > 0
                        || value.compareTo(band.maxValue()) == 0 && !band.maxInclusive());
    }

    private static BigDecimal distanceToRange(EffectiveGoalBand band, BigDecimal value) {
        if (isBelow(band, value)) {
            return band.minValue().subtract(value);
        }
        if (isAbove(band, value)) {
            return value.subtract(band.maxValue());
        }
        return BigDecimal.ZERO;
    }

    public record GoalClassification(
            NutrientType nutrient,
            NutritionUnit unit,
            BigDecimal value,
            String bandLabel,
            GoalTone bandTone,
            Boolean attained,
            GoalReference reference) {
    }

    public record GoalReference(
            String label,
            BigDecimal minValue,
            BigDecimal maxValue,
            boolean minInclusive,
            boolean maxInclusive,
            BigDecimal remainingToRange,
            BigDecimal excessOverRange,
            BigDecimal distanceToRange) {
    }
}

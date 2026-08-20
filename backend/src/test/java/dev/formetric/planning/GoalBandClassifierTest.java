package dev.formetric.planning;

import static org.assertj.core.api.Assertions.assertThat;

import dev.formetric.planning.PlanningDataProvider.EffectiveGoalBand;
import dev.formetric.planning.PlanningDataProvider.EffectiveNutrientTarget;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class GoalBandClassifierTest {

    @Test
    void classifiesInclusiveBoundariesAndKeepsToneSeparateFromAttainment() {
        EffectiveNutrientTarget calories = target(List.of(
                band(0, null, "2400", false, false, "Abaixo", GoalTone.WARNING, false),
                band(1, "2400", "2600", true, true, "Planejado", GoalTone.POSITIVE, true),
                band(2, "2600", null, false, false, "Acima", GoalTone.NEUTRAL, false)));

        var lowerBoundary = GoalBandClassifier.classify(calories, new BigDecimal("2400"));
        var upperBoundary = GoalBandClassifier.classify(calories, new BigDecimal("2600"));
        var above = GoalBandClassifier.classify(calories, new BigDecimal("2600.500"));

        assertThat(lowerBoundary.bandLabel()).isEqualTo("Planejado");
        assertThat(lowerBoundary.bandTone()).isEqualTo(GoalTone.POSITIVE);
        assertThat(lowerBoundary.attained()).isTrue();
        assertThat(upperBoundary.attained()).isTrue();
        assertThat(above.bandLabel()).isEqualTo("Acima");
        assertThat(above.bandTone()).isEqualTo(GoalTone.NEUTRAL);
        assertThat(above.attained()).isFalse();
        assertThat(above.reference().label()).isEqualTo("Planejado");
        assertThat(above.reference().excessOverRange()).isEqualByComparingTo("0.500");
        assertThat(above.reference().distanceToRange()).isEqualByComparingTo("0.500");
    }

    @Test
    void gapUsesNearestAttainedReferenceAndBreaksDistanceTiesByPosition() {
        EffectiveNutrientTarget calories = target(List.of(
                band(2, "170", "200", true, true, "Segunda", GoalTone.POSITIVE, true),
                band(0, "100", "150", true, true, "Primeira", GoalTone.POSITIVE, true)));

        var classification = GoalBandClassifier.classify(calories, new BigDecimal("160"));

        assertThat(classification.bandLabel()).isNull();
        assertThat(classification.bandTone()).isNull();
        assertThat(classification.attained()).isFalse();
        assertThat(classification.reference().label()).isEqualTo("Primeira");
        assertThat(classification.reference().excessOverRange()).isEqualByComparingTo("10");
        assertThat(classification.reference().distanceToRange()).isEqualByComparingTo("10");
    }

    @Test
    void missingValueKeepsCurrentBandAndAttainmentNullButReturnsFirstAttainedReference() {
        EffectiveNutrientTarget calories = target(List.of(
                band(3, "2500", null, true, false, "Alta", GoalTone.POSITIVE, true),
                band(1, "2200", "2400", true, true, "Preferida", GoalTone.POSITIVE, true)));

        var classification = GoalBandClassifier.classify(calories, null);

        assertThat(classification.value()).isNull();
        assertThat(classification.bandLabel()).isNull();
        assertThat(classification.bandTone()).isNull();
        assertThat(classification.attained()).isNull();
        assertThat(classification.reference().label()).isEqualTo("Preferida");
        assertThat(classification.reference().distanceToRange()).isNull();
    }

    @Test
    void exclusiveBoundaryIsOutsideWithZeroMathematicalDistance() {
        EffectiveNutrientTarget calories = target(List.of(
                band(0, "2400", null, false, false, "Acima de 2400", GoalTone.POSITIVE, true)));

        var classification = GoalBandClassifier.classify(calories, new BigDecimal("2400"));

        assertThat(classification.bandLabel()).isNull();
        assertThat(classification.attained()).isFalse();
        assertThat(classification.reference().remainingToRange()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(classification.reference().distanceToRange()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    private static EffectiveNutrientTarget target(List<EffectiveGoalBand> bands) {
        return new EffectiveNutrientTarget(NutrientType.CALORIES, NutritionUnit.KCAL, bands);
    }

    private static EffectiveGoalBand band(
            int position,
            String minimum,
            String maximum,
            boolean minimumInclusive,
            boolean maximumInclusive,
            String label,
            GoalTone tone,
            boolean attained) {
        return new EffectiveGoalBand(
                position,
                minimum == null ? null : new BigDecimal(minimum),
                maximum == null ? null : new BigDecimal(maximum),
                minimumInclusive,
                maximumInclusive,
                label,
                tone,
                attained);
    }
}

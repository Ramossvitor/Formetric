package dev.formetric.planning;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlanningRulesTest {

    @Test
    void acceptsOrderedBandsWithGapsAndComplementarySharedBoundaries() {
        List<GoalBandDefinition> bands = List.of(
                band(0, null, "150", false, false),
                band(1, "150", "174", true, true),
                band(2, "175", null, true, false));

        List<GoalBandDefinition> result = PlanningRules.validateAndOrderBands(bands);

        assertEquals(List.of(0, 1, 2), result.stream().map(GoalBandDefinition::position).toList());
    }

    @Test
    void rejectsBandsThatBothIncludeTheirSharedBoundary() {
        List<GoalBandDefinition> bands = List.of(
                band(0, null, "150", false, true),
                band(1, "150", null, true, false));

        PlanningValidationException exception = assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateAndOrderBands(bands));

        assertEquals("bands", exception.field());
    }

    @Test
    void rejectsInvertedRangeAndNonSequentialPositions() {
        assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateAndOrderBands(List.of(band(0, "200", "100", true, true))));
        assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateAndOrderBands(List.of(
                        band(1, null, "100", false, true),
                        band(2, "100", null, false, false))));
    }

    @Test
    void validatesHalfOpenDateIntervals() {
        assertDoesNotThrow(() -> PlanningRules.validateInterval(
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 9, 1)));
        assertDoesNotThrow(() -> PlanningRules.validateInterval(LocalDate.of(2026, 8, 1), null));
        assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateInterval(
                        LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 1)));
    }

    @Test
    void rejectsDuplicateNutrients() {
        NutrientTargetDefinition protein = new NutrientTargetDefinition(
                NutrientType.PROTEIN,
                NutritionUnit.G,
                List.of(band(0, null, null, false, false)));

        assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateAndNormalizeTargets(List.of(protein, protein)));
    }

    private static GoalBandDefinition band(
            int position,
            String minimum,
            String maximum,
            boolean minimumInclusive,
            boolean maximumInclusive) {
        return new GoalBandDefinition(
                position,
                minimum == null ? null : new BigDecimal(minimum),
                maximum == null ? null : new BigDecimal(maximum),
                minimumInclusive,
                maximumInclusive,
                "Faixa " + position,
                GoalTone.NEUTRAL);
    }
}

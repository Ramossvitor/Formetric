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
    void rejectsMoreThanTwentyBands() {
        List<GoalBandDefinition> bands = java.util.stream.IntStream.range(0, 21)
                .mapToObj(position -> band(position, null, null, false, false))
                .toList();

        PlanningValidationException exception = assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateAndOrderBands(bands));

        assertEquals("bands", exception.field());
    }

    @Test
    void rejectsEmptyRangesAndTargetsWithoutAnAttainedBand() {
        GoalBandDefinition emptyRange = new GoalBandDefinition(
                0,
                new BigDecimal("175"),
                new BigDecimal("175"),
                true,
                false,
                "Vazia",
                GoalTone.NEUTRAL,
                true);
        GoalBandDefinition neverAttained = new GoalBandDefinition(
                0,
                null,
                null,
                false,
                false,
                "Classificação",
                GoalTone.NEUTRAL,
                false);

        PlanningValidationException emptyException = assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateAndOrderBands(List.of(emptyRange)));
        PlanningValidationException attainmentException = assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateAndOrderBands(List.of(neverAttained)));

        assertEquals("bands", emptyException.field());
        assertEquals("bands", attainmentException.field());
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

    @Test
    void enforcesCanonicalUnitsForWaterAndGramBasedNutrients() {
        NutrientTargetDefinition waterInGrams = new NutrientTargetDefinition(
                NutrientType.WATER,
                NutritionUnit.G,
                List.of(band(0, null, null, false, false)));

        PlanningValidationException waterException = assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateAndNormalizeTargets(List.of(waterInGrams)));
        assertEquals("targets", waterException.field());

        for (NutrientType nutrient : List.of(
                NutrientType.PROTEIN,
                NutrientType.CARBOHYDRATE,
                NutrientType.FAT,
                NutrientType.FIBER)) {
            NutrientTargetDefinition targetInMilliliters = new NutrientTargetDefinition(
                    nutrient,
                    NutritionUnit.ML,
                    List.of(band(0, null, null, false, false)));
            PlanningValidationException exception = assertThrows(
                    PlanningValidationException.class,
                    () -> PlanningRules.validateAndNormalizeTargets(List.of(targetInMilliliters)));
            assertEquals("targets", exception.field());
        }

        NutrientTargetDefinition caloriesInGrams = new NutrientTargetDefinition(
                NutrientType.CALORIES,
                NutritionUnit.G,
                List.of(attainedBand("2400", "2600")));
        PlanningValidationException calorieException = assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateAndNormalizeTargets(List.of(caloriesInGrams)));
        assertEquals("targets", calorieException.field());

        NutrientTargetDefinition caloriesInKcal = new NutrientTargetDefinition(
                NutrientType.CALORIES,
                NutritionUnit.KCAL,
                List.of(attainedBand("2400", "2600")));
        assertDoesNotThrow(() -> PlanningRules.validateAndNormalizeTargets(List.of(caloriesInKcal)));
    }

    @Test
    void calorieClassificationRequiresNominalTargetInsideAnAttainedBand() {
        NutrientTargetDefinition calories = new NutrientTargetDefinition(
                NutrientType.CALORIES,
                NutritionUnit.KCAL,
                List.of(attainedBand("2400", "2600")));

        PlanningValidationException missingTarget = assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateCalorieTarget(null, List.of(calories)));
        PlanningValidationException outsideTarget = assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateCalorieTarget(new BigDecimal("2700"), List.of(calories)));

        assertEquals("calorieTarget", missingTarget.field());
        assertEquals("calorieTarget", outsideTarget.field());
        assertDoesNotThrow(() -> PlanningRules.validateCalorieTarget(
                new BigDecimal("2400"), List.of(calories)));
        assertDoesNotThrow(() -> PlanningRules.validateCalorieTarget(
                new BigDecimal("2600"), List.of(calories)));
        assertDoesNotThrow(() -> PlanningRules.validateCalorieTarget(null, List.of()));

        NutrientTargetDefinition exclusiveCalories = new NutrientTargetDefinition(
                NutrientType.CALORIES,
                NutritionUnit.KCAL,
                List.of(new GoalBandDefinition(
                        0,
                        new BigDecimal("2400"),
                        new BigDecimal("2600"),
                        false,
                        false,
                        "Planejado",
                        GoalTone.POSITIVE,
                        true)));
        assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateCalorieTarget(
                        new BigDecimal("2400"), List.of(exclusiveCalories)));
        assertThrows(
                PlanningValidationException.class,
                () -> PlanningRules.validateCalorieTarget(
                        new BigDecimal("2600"), List.of(exclusiveCalories)));
    }

    private static GoalBandDefinition attainedBand(String minimum, String maximum) {
        return new GoalBandDefinition(
                0,
                new BigDecimal(minimum),
                new BigDecimal(maximum),
                true,
                true,
                "Planejado",
                GoalTone.POSITIVE,
                true);
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
                GoalTone.NEUTRAL,
                position > 0);
    }
}

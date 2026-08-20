package dev.formetric.analytics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.formetric.diary.DailyLogStatus;
import dev.formetric.diary.DiaryDataProvider.DiaryDayData;
import dev.formetric.planning.GoalTone;
import dev.formetric.planning.NutrientType;
import dev.formetric.planning.NutritionUnit;
import dev.formetric.planning.PlanningDataProvider.EffectiveGoalBand;
import dev.formetric.planning.PlanningDataProvider.EffectiveNutrientTarget;
import dev.formetric.planning.PlanningDataProvider.EffectiveNutritionGoals;
import dev.formetric.planning.PlanningDataProvider.PlanningTimeline;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnalyticsCalculationsTest {

    @Test
    void closedFastingConfirmsZeroNutritionWithoutInventingWater() {
        DiaryDayData fasting = day(
                "2026-08-01", DailyLogStatus.CLOSED, true,
                null, null, null, null, null, null);

        var values = AnalyticsCalculations.historicalValues(fasting);

        assertEquals(new BigDecimal("0.000"), values.caloriesKcal());
        assertEquals(new BigDecimal("0.000"), values.proteinG());
        assertNull(values.waterMl());

        DiaryDayData fastingWithWater = day(
                "2026-08-02", DailyLogStatus.CLOSED, true,
                null, null, null, null, null, "1500");
        assertEquals(
                new BigDecimal("1500.000"),
                AnalyticsCalculations.historicalValues(fastingWithWater).waterMl());
    }

    @Test
    void openSnapshotStaysVisibleButIsNeverHistorical() {
        DiaryDayData open = day(
                "2026-08-01", DailyLogStatus.OPEN, false,
                "1250", "100", "130", "35", "18", "900");

        assertEquals(
                new BigDecimal("1250.000"),
                AnalyticsCalculations.snapshotValues(open).caloriesKcal());
        assertNull(AnalyticsCalculations.historicalValues(open).caloriesKcal());
        assertNull(AnalyticsCalculations.energyBalance(open, new BigDecimal("2500")));
        assertEquals(
                new BigDecimal("-1250.000"),
                AnalyticsCalculations.projectedEnergyBalance(open, new BigDecimal("2500")));
    }

    @Test
    void aggregateDistinguishesNoObservationFromConfirmedZero() {
        var missing = AnalyticsCalculations.aggregate(List.of());
        var oneFastingAndOneDay = AnalyticsCalculations.aggregate(
                java.util.Arrays.asList(BigDecimal.ZERO, new BigDecimal("2000"), null));

        assertNull(missing.total());
        assertNull(missing.average());
        assertEquals(0, missing.sampleCount());
        assertEquals(new BigDecimal("2000.000"), oneFastingAndOneDay.total());
        assertEquals(new BigDecimal("1000.000"), oneFastingAndOneDay.average());
        assertEquals(2, oneFastingAndOneDay.sampleCount());
    }

    @Test
    void energyUsesOnlyEligibleClosedDaysAndReportsMagnitudeSeparately() {
        var energy = AnalyticsCalculations.energy(List.of(
                new AnalyticsCalculations.EnergyDay(LocalDate.parse("2026-08-01"), true,
                        new BigDecimal("2000"), new BigDecimal("2500")),
                new AnalyticsCalculations.EnergyDay(LocalDate.parse("2026-08-02"), true,
                        new BigDecimal("2700"), new BigDecimal("2500")),
                new AnalyticsCalculations.EnergyDay(LocalDate.parse("2026-08-03"), true,
                        new BigDecimal("2500"), new BigDecimal("2500")),
                new AnalyticsCalculations.EnergyDay(LocalDate.parse("2026-08-04"), true,
                        new BigDecimal("2000"), null),
                new AnalyticsCalculations.EnergyDay(LocalDate.parse("2026-08-05"), true,
                        null, new BigDecimal("2500")),
                new AnalyticsCalculations.EnergyDay(LocalDate.parse("2026-08-06"), false,
                        new BigDecimal("1501"), new BigDecimal("2500"))));

        assertEquals(new BigDecimal("-300.000"), energy.netBalanceKcal());
        assertEquals(new BigDecimal("500.000"), energy.deficitMagnitudeKcal());
        assertEquals(new BigDecimal("200.000"), energy.surplusKcal());
        assertEquals(new BigDecimal("-100.000"), energy.averageBalanceKcal());
        assertEquals(3, energy.eligibleDays());
        assertEquals(1, energy.missingTdeeDays());
        assertEquals(1, energy.missingNutritionDays());
        assertEquals(1, energy.deficitDays());
        assertEquals(1, energy.surplusDays());
        assertEquals(1, energy.neutralDays());
        assertEquals(LocalDate.parse("2026-08-01"), energy.largestDeficit().date());
        assertEquals(new BigDecimal("-500.000"), energy.largestDeficit().balanceKcal());
        assertEquals(LocalDate.parse("2026-08-02"), energy.largestSurplus().date());
        assertEquals(new BigDecimal("200.000"), energy.largestSurplus().balanceKcal());
    }

    @Test
    void energyCountsMissingNutritionAndTdeeIndependentlyForTheSameClosedDay() {
        var energy = AnalyticsCalculations.energy(List.of(
                new AnalyticsCalculations.EnergyDay(
                        LocalDate.parse("2026-08-01"), true, null, null)));

        assertEquals(0, energy.eligibleDays());
        assertEquals(1, energy.missingNutritionDays());
        assertEquals(1, energy.missingTdeeDays());
    }

    @Test
    void attainmentFollowsVersionedBusinessFlagAndNeverVisualTone() {
        LocalDate firstDate = LocalDate.parse("2026-08-01");
        LocalDate secondDate = LocalDate.parse("2026-08-02");
        EffectiveNutritionGoals firstGoals = goals(
                firstDate,
                secondDate,
                new EffectiveGoalBand(
                        0, new BigDecimal("150"), null, true, false,
                        "Meta discreta", GoalTone.WARNING, true));
        EffectiveNutritionGoals secondGoals = goals(
                secondDate,
                null,
                new EffectiveGoalBand(
                        0, new BigDecimal("150"), null, true, false,
                        "Apenas visual", GoalTone.POSITIVE, false));
        PlanningTimeline timeline = new PlanningTimeline(List.of(), List.of(firstGoals, secondGoals));
        Map<LocalDate, DiaryDayData> diary = Map.of(
                firstDate, day("2026-08-01", DailyLogStatus.CLOSED, false,
                        "2000", "160", "100", "50", "20", null),
                secondDate, day("2026-08-02", DailyLogStatus.CLOSED, false,
                        "2000", "160", "100", "50", "20", null));

        var protein = AnalyticsCalculations.goalAttainment(
                        diary, timeline, firstDate, secondDate)
                .stream()
                .filter(metric -> metric.nutrient() == NutrientType.PROTEIN)
                .findFirst()
                .orElseThrow();

        assertTrue(protein.configured());
        assertEquals(1, protein.attainedDays());
        assertEquals(2, protein.eligibleDays());
        assertEquals(new BigDecimal("50.00"), protein.attainedPercentage());
        assertFalse(timeline.effectiveNutritionGoals(secondDate).isEmpty());
    }

    @Test
    void waterAttainmentUsesMillilitersFromClosedDiaryEntries() {
        LocalDate date = LocalDate.parse("2026-08-01");
        EffectiveGoalBand attainedBand = new EffectiveGoalBand(
                0, new BigDecimal("2000"), null, true, false,
                "Meta de água", GoalTone.POSITIVE, true);
        EffectiveNutritionGoals waterGoals = new EffectiveNutritionGoals(
                UUID.randomUUID(), date, null, null,
                List.of(new EffectiveNutrientTarget(
                        NutrientType.WATER, NutritionUnit.ML, List.of(attainedBand))));
        PlanningTimeline timeline = new PlanningTimeline(List.of(), List.of(waterGoals));
        Map<LocalDate, DiaryDayData> diary = Map.of(
                date, day("2026-08-01", DailyLogStatus.CLOSED, false,
                        "2000", "150", "200", "60", "25", "2500"));

        var water = AnalyticsCalculations.goalAttainment(diary, timeline, date, date).stream()
                .filter(metric -> metric.nutrient() == NutrientType.WATER)
                .findFirst()
                .orElseThrow();

        assertTrue(water.configured());
        assertEquals(1, water.eligibleDays());
        assertEquals(1, water.attainedDays());
        assertEquals(new BigDecimal("100.00"), water.attainedPercentage());
    }

    @Test
    void dailyProgressUsesTheContainingOrNearestAttainedBandAsANeutralVersionedReference() {
        EffectiveNutrientTarget target = new EffectiveNutrientTarget(
                NutrientType.PROTEIN,
                NutritionUnit.G,
                List.of(
                        new EffectiveGoalBand(
                                0, null, new BigDecimal("175"), false, false,
                                "Abaixo", GoalTone.WARNING, false),
                        new EffectiveGoalBand(
                                1, new BigDecimal("175"), new BigDecimal("190"), true, false,
                                "Meta", GoalTone.POSITIVE, true),
                        new EffectiveGoalBand(
                                2, new BigDecimal("190"), null, true, false,
                                "Excelente", GoalTone.POSITIVE, true)));

        var below = AnalyticsCalculations.goalProgress(target, new BigDecimal("162"));
        assertEquals("Abaixo", below.bandLabel());
        assertEquals(GoalTone.WARNING, below.bandTone());
        assertFalse(below.attained());
        assertEquals("Meta", below.reference().label());
        assertEquals(new BigDecimal("175"), below.reference().minValue());
        assertEquals(new BigDecimal("190"), below.reference().maxValue());
        assertEquals(new BigDecimal("13.000"), below.reference().remainingToRange());
        assertNull(below.reference().excessOverRange());

        var aboveFirstRange = AnalyticsCalculations.goalProgress(target, new BigDecimal("195"));
        assertEquals("Excelente", aboveFirstRange.bandLabel());
        assertEquals(GoalTone.POSITIVE, aboveFirstRange.bandTone());
        assertTrue(aboveFirstRange.attained());
        assertEquals("Excelente", aboveFirstRange.reference().label());
        assertEquals(new BigDecimal("190"), aboveFirstRange.reference().minValue());
        assertNull(aboveFirstRange.reference().maxValue());
        assertNull(aboveFirstRange.reference().remainingToRange());
        assertNull(aboveFirstRange.reference().excessOverRange());

        var missingValue = AnalyticsCalculations.goalProgress(target, null);
        assertNull(missingValue.value());
        assertNull(missingValue.bandLabel());
        assertNull(missingValue.bandTone());
        assertNull(missingValue.attained());
        assertEquals("Meta", missingValue.reference().label());

        EffectiveNutrientTarget exclusiveTarget = new EffectiveNutrientTarget(
                NutrientType.PROTEIN,
                NutritionUnit.G,
                List.of(new EffectiveGoalBand(
                        0, new BigDecimal("175"), null, false, false,
                        "Acima de 175", GoalTone.POSITIVE, true)));
        var exclusiveBoundary = AnalyticsCalculations.goalProgress(exclusiveTarget, new BigDecimal("175"));
        assertFalse(exclusiveBoundary.reference().minInclusive());
        assertEquals(BigDecimal.ZERO.setScale(3), exclusiveBoundary.reference().remainingToRange());
    }

    @Test
    void seriesRangeIsInclusiveAndCappedAt366Days() {
        AnalyticsRules.validateSeries(
                AnalyticsMetric.CALORIES,
                LocalDate.parse("2024-01-01"),
                LocalDate.parse("2024-12-31"));

        AnalyticsValidationException exception = assertThrows(
                AnalyticsValidationException.class,
                () -> AnalyticsRules.validateSeries(
                        AnalyticsMetric.CALORIES,
                        LocalDate.parse("2024-01-01"),
                        LocalDate.parse("2025-01-01")));
        assertEquals("to", exception.field());

        AnalyticsValidationException inverted = assertThrows(
                AnalyticsValidationException.class,
                () -> AnalyticsRules.validateSeries(
                        AnalyticsMetric.CALORIES,
                        LocalDate.parse("2026-08-02"),
                        LocalDate.parse("2026-08-01")));
        assertEquals("to", inverted.field());
    }

    private static EffectiveNutritionGoals goals(
            LocalDate from, LocalDate to, EffectiveGoalBand band) {
        return new EffectiveNutritionGoals(
                UUID.randomUUID(), from, to, new BigDecimal("2500"),
                List.of(new EffectiveNutrientTarget(
                        NutrientType.PROTEIN, NutritionUnit.G, List.of(band))));
    }

    private static DiaryDayData day(
            String date,
            DailyLogStatus status,
            boolean fasting,
            String kcal,
            String protein,
            String carbohydrate,
            String fat,
            String fiber,
            String water) {
        int itemCount = kcal == null ? 0 : 1;
        int waterCount = water == null ? 0 : 1;
        return new DiaryDayData(
                LocalDate.parse(date), status, fasting, itemCount,
                decimal(kcal), decimal(protein), decimal(carbohydrate), decimal(fat), decimal(fiber),
                waterCount, decimal(water));
    }

    private static BigDecimal decimal(String value) {
        return value == null ? null : new BigDecimal(value);
    }
}

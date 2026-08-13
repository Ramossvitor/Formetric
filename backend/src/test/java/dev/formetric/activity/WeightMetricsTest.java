package dev.formetric.activity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class WeightMetricsTest {

    private static final UUID USER_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final Instant NOW = Instant.parse("2026-08-13T12:00:00Z");

    @Test
    void movingAveragesUseCivilDayWindowsAndExcludeSparseOldObservations() {
        List<WeightLog> entries = List.of(
                weight("2026-01-01", "100.000"),
                weight("2026-01-14", "95.000"),
                weight("2026-01-20", "90.000"),
                weight("2026-01-24", "88.000"),
                weight("2026-01-28", "86.000"));

        WeightOverviewMetrics metrics = WeightMetrics.calculate(entries);

        assertEquals(new BigDecimal("87.000"), metrics.movingAverage7().valueKg());
        assertEquals(2, metrics.movingAverage7().sampleCount());
        assertEquals(new BigDecimal("88.000"), metrics.movingAverage14().valueKg());
        assertEquals(3, metrics.movingAverage14().sampleCount());
        assertEquals(new BigDecimal("-14.000"), metrics.changeKg());
        assertEquals(5, metrics.trend().sampleCount());
        assertEquals(LocalDate.parse("2026-01-01"), metrics.trend().from());
        assertEquals(LocalDate.parse("2026-01-28"), metrics.trend().to());
    }

    @Test
    void trendIsUnavailableUntilThreeObservationsExist() {
        WeightOverviewMetrics empty = WeightMetrics.calculate(List.of());
        WeightOverviewMetrics twoEntries = WeightMetrics.calculate(List.of(
                weight("2026-01-01", "90"),
                weight("2026-01-10", "89")));

        assertNull(empty.currentWeightKg());
        assertNull(empty.movingAverage7());
        assertNull(empty.trend());
        assertNull(twoEntries.trend());
        assertEquals(1, twoEntries.movingAverage7().sampleCount());
    }

    @Test
    void workoutRulesRequireCustomOtherAndMuscleGroupsForStrength() {
        assertThrows(ActivityValidationException.class, () -> Workout.create(
                USER_ID,
                new WorkoutDetails(
                        LocalDate.parse("2026-08-13"), WorkoutModality.OTHER, null, "Esporte", List.of(),
                        null, 60, null, null),
                NOW));
        assertThrows(ActivityValidationException.class, () -> Workout.create(
                USER_ID,
                new WorkoutDetails(
                        LocalDate.parse("2026-08-13"), WorkoutModality.STRENGTH, null, "Treino A", List.of(),
                        null, 60, null, null),
                NOW));
        assertThrows(ActivityValidationException.class, () -> Workout.create(
                USER_ID,
                new WorkoutDetails(
                        LocalDate.parse("2026-08-13"), WorkoutModality.STRENGTH, null, "Treino A",
                        List.of("Peito", " peito "), null, 60, null, null),
                NOW));
    }

    private static WeightLog weight(String date, String kg) {
        return WeightLog.create(
                USER_ID,
                LocalDate.parse(date),
                new WeightDetails(new BigDecimal(kg), LocalTime.of(8, 0), "Em jejum", null),
                NOW);
    }
}

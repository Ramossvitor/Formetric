package dev.formetric.activity;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

final class WeightMetrics {

    private static final int SCALE = 3;

    private WeightMetrics() {
    }

    static WeightOverviewMetrics calculate(List<WeightLog> chronologicalEntries) {
        if (chronologicalEntries.isEmpty()) {
            return WeightOverviewMetrics.empty();
        }
        WeightLog first = chronologicalEntries.getFirst();
        WeightLog current = chronologicalEntries.getLast();
        BigDecimal minimum = chronologicalEntries.stream()
                .map(WeightLog::weightKg)
                .min(BigDecimal::compareTo)
                .orElseThrow();
        BigDecimal maximum = chronologicalEntries.stream()
                .map(WeightLog::weightKg)
                .max(BigDecimal::compareTo)
                .orElseThrow();
        return new WeightOverviewMetrics(
                scaled(current.weightKg()),
                scaled(minimum),
                scaled(maximum),
                scaled(current.weightKg().subtract(first.weightKg())),
                averageWithinDays(chronologicalEntries, 7),
                averageWithinDays(chronologicalEntries, 14),
                trend(chronologicalEntries));
    }

    private static WeightAverageMetric averageWithinDays(List<WeightLog> entries, int windowDays) {
        LocalDate cutoff = entries.getLast().date().minusDays(windowDays - 1L);
        List<WeightLog> samples = entries.stream()
                .filter(entry -> !entry.date().isBefore(cutoff))
                .toList();
        BigDecimal sum = samples.stream()
                .map(WeightLog::weightKg)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new WeightAverageMetric(
                sum.divide(BigDecimal.valueOf(samples.size()), SCALE, RoundingMode.HALF_UP),
                samples.size());
    }

    private static WeightTrendMetric trend(List<WeightLog> entries) {
        LocalDate latestDate = entries.getLast().date();
        LocalDate cutoff = latestDate.minusDays(27);
        List<WeightLog> samples = entries.stream()
                .filter(entry -> !entry.date().isBefore(cutoff))
                .toList();
        if (samples.size() < 3) {
            return null;
        }

        long firstEpochDay = samples.getFirst().date().toEpochDay();
        BigDecimal n = BigDecimal.valueOf(samples.size());
        BigDecimal sumX = BigDecimal.ZERO;
        BigDecimal sumY = BigDecimal.ZERO;
        BigDecimal sumXy = BigDecimal.ZERO;
        BigDecimal sumX2 = BigDecimal.ZERO;
        for (WeightLog sample : samples) {
            BigDecimal x = BigDecimal.valueOf(sample.date().toEpochDay() - firstEpochDay);
            BigDecimal y = sample.weightKg();
            sumX = sumX.add(x);
            sumY = sumY.add(y);
            sumXy = sumXy.add(x.multiply(y));
            sumX2 = sumX2.add(x.multiply(x));
        }
        BigDecimal denominator = n.multiply(sumX2).subtract(sumX.multiply(sumX));
        if (denominator.signum() == 0) {
            return null;
        }
        BigDecimal numerator = n.multiply(sumXy).subtract(sumX.multiply(sumY));
        BigDecimal kgPerWeek = numerator
                .divide(denominator, 12, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(7));
        return new WeightTrendMetric(
                scaled(kgPerWeek),
                samples.size(),
                samples.getFirst().date(),
                samples.getLast().date());
    }

    private static BigDecimal scaled(BigDecimal value) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
    }
}

record WeightOverviewMetrics(
        BigDecimal currentWeightKg,
        BigDecimal minimumWeightKg,
        BigDecimal maximumWeightKg,
        BigDecimal changeKg,
        WeightAverageMetric movingAverage7,
        WeightAverageMetric movingAverage14,
        WeightTrendMetric trend) {

    static WeightOverviewMetrics empty() {
        return new WeightOverviewMetrics(null, null, null, null, null, null, null);
    }
}

record WeightAverageMetric(BigDecimal valueKg, int sampleCount) {
}

record WeightTrendMetric(BigDecimal kgPerWeek, int sampleCount, LocalDate from, LocalDate to) {
}

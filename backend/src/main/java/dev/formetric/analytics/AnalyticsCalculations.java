package dev.formetric.analytics;

import dev.formetric.diary.DailyLogStatus;
import dev.formetric.diary.DiaryDataProvider.DiaryDayData;
import dev.formetric.planning.NutrientType;
import dev.formetric.planning.PlanningDataProvider.EffectiveGoalBand;
import dev.formetric.planning.PlanningDataProvider.EffectiveNutrientTarget;
import dev.formetric.planning.PlanningDataProvider.EffectiveNutritionGoals;
import dev.formetric.planning.PlanningDataProvider.PlanningTimeline;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

final class AnalyticsCalculations {

    private static final int VALUE_SCALE = 3;
    private static final int PERCENT_SCALE = 2;
    private static final MathContext MATH_CONTEXT = MathContext.DECIMAL128;
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private AnalyticsCalculations() {
    }

    static DailyValues snapshotValues(DiaryDayData day) {
        if (day == null) {
            return DailyValues.missing();
        }
        boolean confirmedFasting = day.status() == DailyLogStatus.CLOSED && day.fastingConfirmed();
        return new DailyValues(
                valueOrConfirmedZero(day.caloriesKcal(), confirmedFasting),
                valueOrConfirmedZero(day.proteinG(), confirmedFasting),
                valueOrConfirmedZero(day.carbohydrateG(), confirmedFasting),
                valueOrConfirmedZero(day.fatG(), confirmedFasting),
                valueOrConfirmedZero(day.fiberG(), confirmedFasting),
                normalize(day.waterMl()));
    }

    static DailyValues historicalValues(DiaryDayData day) {
        if (day == null || day.status() != DailyLogStatus.CLOSED) {
            return DailyValues.missing();
        }
        return snapshotValues(day);
    }

    static BigDecimal metricValue(DailyValues values, AnalyticsMetric metric) {
        return switch (metric) {
            case CALORIES -> values.caloriesKcal();
            case PROTEIN -> values.proteinG();
            case CARBOHYDRATE -> values.carbohydrateG();
            case FAT -> values.fatG();
            case FIBER -> values.fiberG();
            case WATER -> values.waterMl();
            case ENERGY_BALANCE, WEIGHT -> null;
        };
    }

    static BigDecimal nutrientValue(DailyValues values, NutrientType nutrient) {
        return switch (nutrient) {
            case PROTEIN -> values.proteinG();
            case CARBOHYDRATE -> values.carbohydrateG();
            case FAT -> values.fatG();
            case FIBER -> values.fiberG();
            case WATER -> values.waterMl();
        };
    }

    static BigDecimal energyBalance(DiaryDayData day, BigDecimal tdeeKcal) {
        if (day == null || day.status() != DailyLogStatus.CLOSED || tdeeKcal == null) {
            return null;
        }
        BigDecimal calories = historicalValues(day).caloriesKcal();
        return calories == null ? null : normalize(calories.subtract(tdeeKcal));
    }

    static BigDecimal projectedEnergyBalance(DiaryDayData day, BigDecimal tdeeKcal) {
        if (day == null || day.status() != DailyLogStatus.OPEN || tdeeKcal == null) {
            return null;
        }
        BigDecimal calories = snapshotValues(day).caloriesKcal();
        return calories == null ? null : normalize(calories.subtract(tdeeKcal));
    }

    static MetricAggregate aggregate(List<BigDecimal> values) {
        List<BigDecimal> present = values.stream().filter(java.util.Objects::nonNull).toList();
        if (present.isEmpty()) {
            return new MetricAggregate(null, null, 0);
        }
        BigDecimal total = present.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return new MetricAggregate(
                normalize(total),
                normalize(total.divide(BigDecimal.valueOf(present.size()), MATH_CONTEXT)),
                present.size());
    }

    static EnergyAggregate energy(List<EnergyDay> days) {
        int missingTdeeDays = 0;
        int missingNutritionDays = 0;
        int deficitDays = 0;
        int surplusDays = 0;
        int neutralDays = 0;
        List<BigDecimal> balances = new ArrayList<>();
        EnergyExtreme largestDeficit = null;
        EnergyExtreme largestSurplus = null;
        for (EnergyDay day : days) {
            if (!day.closed()) {
                continue;
            }
            boolean missingNutrition = day.caloriesKcal() == null;
            boolean missingTdee = day.tdeeKcal() == null;
            if (missingNutrition) {
                missingNutritionDays++;
            }
            if (missingTdee) {
                missingTdeeDays++;
            }
            if (missingNutrition || missingTdee) {
                continue;
            }
            BigDecimal balance = normalize(day.caloriesKcal().subtract(day.tdeeKcal()));
            balances.add(balance);
            if (balance.signum() < 0) {
                deficitDays++;
                if (largestDeficit == null || balance.compareTo(largestDeficit.balanceKcal()) < 0) {
                    largestDeficit = new EnergyExtreme(day.date(), balance);
                }
            } else if (balance.signum() > 0) {
                surplusDays++;
                if (largestSurplus == null || balance.compareTo(largestSurplus.balanceKcal()) > 0) {
                    largestSurplus = new EnergyExtreme(day.date(), balance);
                }
            } else {
                neutralDays++;
            }
        }
        if (balances.isEmpty()) {
            return new EnergyAggregate(
                    null, null, null, null, 0, missingTdeeDays, missingNutritionDays,
                    deficitDays, surplusDays, neutralDays, null, null);
        }
        BigDecimal net = balances.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal deficits = balances.stream()
                .filter(value -> value.signum() < 0)
                .map(BigDecimal::abs)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal surpluses = balances.stream()
                .filter(value -> value.signum() > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new EnergyAggregate(
                normalize(net),
                normalize(deficits),
                normalize(surpluses),
                normalize(net.divide(BigDecimal.valueOf(balances.size()), MATH_CONTEXT)),
                balances.size(),
                missingTdeeDays,
                missingNutritionDays,
                deficitDays,
                surplusDays,
                neutralDays,
                largestDeficit,
                largestSurplus);
    }

    static List<GoalAttainmentMetric> goalAttainment(
            Map<LocalDate, DiaryDayData> diaryByDate,
            PlanningTimeline planning,
            LocalDate from,
            LocalDate throughDate) {
        EnumMap<NutrientType, MutableAttainment> counters = new EnumMap<>(NutrientType.class);
        for (NutrientType nutrient : NutrientType.values()) {
            counters.put(nutrient, new MutableAttainment());
        }
        if (throughDate != null) {
            for (LocalDate date = from; !date.isAfter(throughDate); date = date.plusDays(1)) {
                EffectiveNutritionGoals goals = planning.effectiveNutritionGoals(date).orElse(null);
                if (goals != null) {
                    goals.targets().forEach(target -> counters.get(target.nutrient()).configured = true);
                }
                DiaryDayData day = diaryByDate.get(date);
                if (day == null || day.status() != DailyLogStatus.CLOSED || goals == null) {
                    continue;
                }
                DailyValues values = historicalValues(day);
                for (EffectiveNutrientTarget target : goals.targets()) {
                    MutableAttainment counter = counters.get(target.nutrient());
                    BigDecimal value = nutrientValue(values, target.nutrient());
                    if (value == null) {
                        continue;
                    }
                    counter.eligibleDays++;
                    if (matchingBand(target, value).map(EffectiveGoalBand::countsAsAttained).orElse(false)) {
                        counter.attainedDays++;
                    }
                }
            }
        }
        return counters.entrySet().stream()
                .map(entry -> entry.getValue().toMetric(entry.getKey()))
                .toList();
    }

    static GoalProgress goalProgress(EffectiveNutrientTarget target, BigDecimal value) {
        EffectiveGoalBand band = value == null ? null : matchingBand(target, value).orElse(null);
        EffectiveGoalBand referenceBand = referenceBand(target, value);
        return new GoalProgress(
                target.nutrient(),
                normalize(value),
                band == null ? null : band.label(),
                value == null ? null : band != null && band.countsAsAttained(),
                goalReference(referenceBand, value));
    }

    private static GoalReference goalReference(EffectiveGoalBand band, BigDecimal value) {
        if (band == null) {
            return null;
        }
        BigDecimal remaining = null;
        BigDecimal excess = null;
        if (value != null && band.minValue() != null) {
            int comparison = value.compareTo(band.minValue());
            if (comparison < 0 || comparison == 0 && !band.minInclusive()) {
                remaining = normalize(band.minValue().subtract(value));
            }
        }
        if (value != null && band.maxValue() != null) {
            int comparison = value.compareTo(band.maxValue());
            if (comparison > 0 || comparison == 0 && !band.maxInclusive()) {
                excess = normalize(value.subtract(band.maxValue()));
            }
        }
        return new GoalReference(
                band.label(),
                normalize(band.minValue()),
                normalize(band.maxValue()),
                band.minInclusive(),
                band.maxInclusive(),
                remaining,
                excess);
    }

    private static EffectiveGoalBand referenceBand(EffectiveNutrientTarget target, BigDecimal value) {
        List<EffectiveGoalBand> attainedBands = target.bands().stream()
                .filter(EffectiveGoalBand::countsAsAttained)
                .sorted(Comparator.comparingInt(EffectiveGoalBand::position))
                .toList();
        if (value == null) {
            return attainedBands.stream().findFirst().orElse(null);
        }
        return attainedBands.stream()
                .filter(band -> contains(band, value))
                .findFirst()
                .orElseGet(() -> attainedBands.stream()
                        .min(Comparator.comparing((EffectiveGoalBand band) -> distanceToRange(band, value))
                                .thenComparingInt(EffectiveGoalBand::position))
                        .orElse(null));
    }

    private static BigDecimal distanceToRange(EffectiveGoalBand band, BigDecimal value) {
        if (band.minValue() != null && value.compareTo(band.minValue()) < 0) {
            return band.minValue().subtract(value);
        }
        if (band.maxValue() != null && value.compareTo(band.maxValue()) > 0) {
            return value.subtract(band.maxValue());
        }
        return BigDecimal.ZERO;
    }

    private static java.util.Optional<EffectiveGoalBand> matchingBand(
            EffectiveNutrientTarget target, BigDecimal value) {
        return target.bands().stream().filter(band -> contains(band, value)).findFirst();
    }

    private static boolean contains(EffectiveGoalBand band, BigDecimal value) {
        boolean aboveMinimum = band.minValue() == null
                || value.compareTo(band.minValue()) > 0
                || band.minInclusive() && value.compareTo(band.minValue()) == 0;
        boolean belowMaximum = band.maxValue() == null
                || value.compareTo(band.maxValue()) < 0
                || band.maxInclusive() && value.compareTo(band.maxValue()) == 0;
        return aboveMinimum && belowMaximum;
    }

    static BigDecimal normalize(BigDecimal value) {
        if (value == null) {
            return null;
        }
        BigDecimal rounded = value.setScale(VALUE_SCALE, RoundingMode.HALF_UP);
        return rounded.signum() == 0 ? BigDecimal.ZERO.setScale(VALUE_SCALE) : rounded;
    }

    private static BigDecimal valueOrConfirmedZero(BigDecimal value, boolean confirmedFasting) {
        return value == null && confirmedFasting ? normalize(BigDecimal.ZERO) : normalize(value);
    }

    record DailyValues(
            BigDecimal caloriesKcal,
            BigDecimal proteinG,
            BigDecimal carbohydrateG,
            BigDecimal fatG,
            BigDecimal fiberG,
            BigDecimal waterMl) {
        static DailyValues missing() {
            return new DailyValues(null, null, null, null, null, null);
        }
    }

    record MetricAggregate(BigDecimal total, BigDecimal average, int sampleCount) {
    }

    record EnergyDay(LocalDate date, boolean closed, BigDecimal caloriesKcal, BigDecimal tdeeKcal) {
    }

    record EnergyExtreme(LocalDate date, BigDecimal balanceKcal) {
    }

    record EnergyAggregate(
            BigDecimal netBalanceKcal,
            BigDecimal deficitMagnitudeKcal,
            BigDecimal surplusKcal,
            BigDecimal averageBalanceKcal,
            int eligibleDays,
            int missingTdeeDays,
            int missingNutritionDays,
            int deficitDays,
            int surplusDays,
            int neutralDays,
            EnergyExtreme largestDeficit,
            EnergyExtreme largestSurplus) {
    }

    record GoalProgress(
            NutrientType nutrient,
            BigDecimal value,
            String bandLabel,
            Boolean attained,
            GoalReference reference) {
    }

    record GoalReference(
            String label,
            BigDecimal minValue,
            BigDecimal maxValue,
            boolean minInclusive,
            boolean maxInclusive,
            BigDecimal remainingToRange,
            BigDecimal excessOverRange) {
    }

    record GoalAttainmentMetric(
            NutrientType nutrient,
            boolean configured,
            int attainedDays,
            int eligibleDays,
            BigDecimal attainedPercentage) {
    }

    private static final class MutableAttainment {
        private boolean configured;
        private int attainedDays;
        private int eligibleDays;

        private GoalAttainmentMetric toMetric(NutrientType nutrient) {
            BigDecimal percentage = eligibleDays == 0
                    ? null
                    : BigDecimal.valueOf(attainedDays)
                            .multiply(HUNDRED)
                            .divide(BigDecimal.valueOf(eligibleDays), MATH_CONTEXT)
                            .setScale(PERCENT_SCALE, RoundingMode.HALF_UP);
            return new GoalAttainmentMetric(
                    nutrient, configured, attainedDays, eligibleDays, percentage);
        }
    }
}

package dev.formetric.analytics;

import dev.formetric.activity.ActivityDataProvider;
import dev.formetric.activity.ActivityDataProvider.WeightData;
import dev.formetric.activity.ActivityDataProvider.WorkoutData;
import dev.formetric.diary.DailyLogStatus;
import dev.formetric.diary.DiaryDataProvider;
import dev.formetric.diary.DiaryDataProvider.DiaryDayData;
import dev.formetric.identity.CurrentUserZoneIdProvider;
import dev.formetric.planning.PlanningDataProvider;
import dev.formetric.planning.PlanningDataProvider.EffectiveNutritionGoals;
import dev.formetric.planning.PlanningDataProvider.PlanningTimeline;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
class AnalyticsService {

    private static final MathContext MATH_CONTEXT = MathContext.DECIMAL128;

    private final DiaryDataProvider diaryDataProvider;
    private final PlanningDataProvider planningDataProvider;
    private final ActivityDataProvider activityDataProvider;
    private final CurrentUserZoneIdProvider currentUserZoneIdProvider;
    private final Clock clock;

    AnalyticsService(
            DiaryDataProvider diaryDataProvider,
            PlanningDataProvider planningDataProvider,
            ActivityDataProvider activityDataProvider,
            CurrentUserZoneIdProvider currentUserZoneIdProvider,
            Clock clock) {
        this.diaryDataProvider = diaryDataProvider;
        this.planningDataProvider = planningDataProvider;
        this.activityDataProvider = activityDataProvider;
        this.currentUserZoneIdProvider = currentUserZoneIdProvider;
        this.clock = clock;
    }

    DailyAnalyticsResponse daily(LocalDate date) {
        AnalyticsRules.validateDate(date);
        DiaryDayData diary = diaryDataProvider.day(date).orElse(null);
        PlanningTimeline planning = planningDataProvider.timeline(date, date);
        List<WeightData> weights = activityDataProvider.weights(date, date);
        List<WorkoutData> workouts = activityDataProvider.workouts(date, date);
        AnalyticsCalculations.DailyValues values = AnalyticsCalculations.snapshotValues(diary);
        BigDecimal tdee = planning.effectiveTdeeKcal(date).orElse(null);
        BigDecimal balance = AnalyticsCalculations.energyBalance(diary, tdee);
        BigDecimal projectedBalance = AnalyticsCalculations.projectedEnergyBalance(diary, tdee);
        EffectiveNutritionGoals goals = planning.effectiveNutritionGoals(date).orElse(null);
        List<GoalProgressResponse> progress = goals == null
                ? List.of()
                : goals.targets().stream()
                        .map(target -> AnalyticsCalculations.goalProgress(
                                target,
                                AnalyticsCalculations.nutrientValue(values, target.nutrient())))
                        .map(metric -> new GoalProgressResponse(
                                metric.nutrient(), metric.value(), metric.bandLabel(), metric.bandTone(), metric.attained(),
                                GoalReferenceResponse.from(metric.reference())))
                        .toList();
        return new DailyAnalyticsResponse(
                date,
                status(diary),
                diary != null && diary.status() == DailyLogStatus.CLOSED && diary.fastingConfirmed(),
                diary != null && diary.status() == DailyLogStatus.CLOSED,
                diary == null ? 0 : diary.foodItemCount(),
                diary == null ? 0 : diary.waterEntryCount(),
                nutrition(values),
                AnalyticsCalculations.normalize(tdee),
                balance,
                projectedBalance,
                energyAvailability(diary, tdee),
                goals == null ? null : AnalyticsCalculations.normalize(goals.calorieTarget()),
                progress,
                weights.stream().findFirst().map(WeightData::weightKg)
                        .map(AnalyticsCalculations::normalize).orElse(null),
                workoutSummary(workouts, null));
    }

    MonthlyAnalyticsResponse monthly(YearMonth month) {
        AnalyticsRules.validateMonth(month);
        LocalDate today = today();
        LocalDate periodStart = month.atDay(1);
        LocalDate periodEnd = month.atEndOfMonth();
        LocalDate throughDate = periodStart.isAfter(today) ? null : min(periodEnd, today);
        int elapsedDays = throughDate == null
                ? 0
                : Math.toIntExact(ChronoUnit.DAYS.between(periodStart, throughDate) + 1);

        if (throughDate == null) {
            return emptyMonth(month, periodStart, periodEnd);
        }

        List<DiaryDayData> diaryDays = diaryDataProvider.timeline(periodStart, throughDate);
        Map<LocalDate, DiaryDayData> diaryByDate = diaryDays.stream()
                .collect(Collectors.toMap(DiaryDayData::date, Function.identity()));
        PlanningTimeline planning = planningDataProvider.timeline(periodStart, throughDate);
        List<WorkoutData> workouts = activityDataProvider.workouts(periodStart, throughDate);
        List<WeightData> weights = activityDataProvider.weights(periodStart, throughDate);

        int closedDays = Math.toIntExact(diaryDays.stream()
                .filter(day -> day.status() == DailyLogStatus.CLOSED)
                .count());
        int openDays = Math.toIntExact(diaryDays.stream()
                .filter(day -> day.status() == DailyLogStatus.OPEN)
                .count());
        int missingDays = elapsedDays - closedDays - openDays;

        List<AnalyticsCalculations.DailyValues> historicalValues = diaryDays.stream()
                .filter(day -> day.status() == DailyLogStatus.CLOSED)
                .map(AnalyticsCalculations::historicalValues)
                .toList();
        MonthlyNutritionResponse nutrition = new MonthlyNutritionResponse(
                aggregate(historicalValues.stream()
                        .map(AnalyticsCalculations.DailyValues::caloriesKcal).toList()),
                aggregate(historicalValues.stream()
                        .map(AnalyticsCalculations.DailyValues::proteinG).toList()),
                aggregate(historicalValues.stream()
                        .map(AnalyticsCalculations.DailyValues::carbohydrateG).toList()),
                aggregate(historicalValues.stream()
                        .map(AnalyticsCalculations.DailyValues::fatG).toList()),
                aggregate(historicalValues.stream()
                        .map(AnalyticsCalculations.DailyValues::fiberG).toList()),
                aggregate(historicalValues.stream()
                        .map(AnalyticsCalculations.DailyValues::waterMl).toList()));

        AnalyticsCalculations.EnergyAggregate energy = AnalyticsCalculations.energy(diaryDays.stream()
                .map(day -> new AnalyticsCalculations.EnergyDay(
                        day.date(),
                        day.status() == DailyLogStatus.CLOSED,
                        AnalyticsCalculations.historicalValues(day).caloriesKcal(),
                        planning.effectiveTdeeKcal(day.date()).orElse(null)))
                .toList());

        List<GoalAttainmentResponse> goalAttainment = AnalyticsCalculations.goalAttainment(
                        diaryByDate, planning, periodStart, throughDate)
                .stream()
                .map(metric -> new GoalAttainmentResponse(
                        metric.nutrient(), metric.configured(), metric.attainedDays(),
                        metric.eligibleDays(), metric.attainedPercentage()))
                .toList();

        return new MonthlyAnalyticsResponse(
                month,
                periodStart,
                periodEnd,
                throughDate,
                elapsedDays,
                closedDays,
                openDays,
                missingDays,
                nutrition,
                energyResponse(energy),
                goalAttainment,
                workoutSummary(workouts, elapsedDays),
                weightSummary(weights),
                consumptionExtreme(diaryDays, true),
                consumptionExtreme(diaryDays, false));
    }

    AnalyticsSeriesResponse series(AnalyticsMetric metric, LocalDate from, LocalDate to) {
        AnalyticsRules.validateSeries(metric, from, to);
        if (metric == AnalyticsMetric.WEIGHT) {
            Map<LocalDate, BigDecimal> weights = activityDataProvider.weights(from, to).stream()
                    .collect(Collectors.toMap(WeightData::date, WeightData::weightKg));
            List<AnalyticsSeriesPointResponse> points = dates(from, to).stream()
                    .map(date -> {
                        BigDecimal value = AnalyticsCalculations.normalize(weights.get(date));
                        return new AnalyticsSeriesPointResponse(
                                date,
                                value,
                                value == null ? AnalyticsAvailability.MISSING_VALUE : AnalyticsAvailability.AVAILABLE);
                    })
                    .toList();
            return new AnalyticsSeriesResponse(metric, unit(metric), from, to, points);
        }

        Map<LocalDate, DiaryDayData> diary = diaryDataProvider.timeline(from, to).stream()
                .collect(Collectors.toMap(DiaryDayData::date, Function.identity()));
        PlanningTimeline planning = metric == AnalyticsMetric.ENERGY_BALANCE
                ? planningDataProvider.timeline(from, to)
                : null;
        List<AnalyticsSeriesPointResponse> points = dates(from, to).stream()
                .map(date -> seriesPoint(metric, date, diary.get(date), planning))
                .toList();
        return new AnalyticsSeriesResponse(metric, unit(metric), from, to, points);
    }

    AnalyticsBoundsResponse bounds() {
        Optional<DiaryDataProvider.DateBounds> diaryBounds = diaryDataProvider.bounds();
        Optional<ActivityDataProvider.DateBounds> activityBounds = activityDataProvider.bounds();
        List<LocalDate> earliest = java.util.stream.Stream.of(
                        diaryBounds.map(DiaryDataProvider.DateBounds::earliestDate),
                        activityBounds.map(ActivityDataProvider.DateBounds::earliestDate))
                .flatMap(Optional::stream)
                .toList();
        List<LocalDate> latest = java.util.stream.Stream.of(
                        diaryBounds.map(DiaryDataProvider.DateBounds::latestDate),
                        activityBounds.map(ActivityDataProvider.DateBounds::latestDate))
                .flatMap(Optional::stream)
                .toList();
        return new AnalyticsBoundsResponse(
                earliest.stream().min(LocalDate::compareTo).orElse(null),
                latest.stream().max(LocalDate::compareTo).orElse(null),
                today());
    }

    private AnalyticsSeriesPointResponse seriesPoint(
            AnalyticsMetric metric,
            LocalDate date,
            DiaryDayData day,
            PlanningTimeline planning) {
        if (day == null) {
            return new AnalyticsSeriesPointResponse(date, null, AnalyticsAvailability.MISSING_LOG);
        }
        if (day.status() == DailyLogStatus.OPEN) {
            return new AnalyticsSeriesPointResponse(date, null, AnalyticsAvailability.OPEN_LOG);
        }
        if (metric == AnalyticsMetric.ENERGY_BALANCE) {
            BigDecimal calories = AnalyticsCalculations.historicalValues(day).caloriesKcal();
            if (calories == null) {
                return new AnalyticsSeriesPointResponse(date, null, AnalyticsAvailability.MISSING_VALUE);
            }
            BigDecimal tdee = planning.effectiveTdeeKcal(date).orElse(null);
            if (tdee == null) {
                return new AnalyticsSeriesPointResponse(date, null, AnalyticsAvailability.MISSING_TDEE);
            }
            return new AnalyticsSeriesPointResponse(
                    date,
                    AnalyticsCalculations.normalize(calories.subtract(tdee)),
                    AnalyticsAvailability.AVAILABLE);
        }
        BigDecimal value = AnalyticsCalculations.metricValue(
                AnalyticsCalculations.historicalValues(day), metric);
        return new AnalyticsSeriesPointResponse(
                date,
                value,
                value == null ? AnalyticsAvailability.MISSING_VALUE : AnalyticsAvailability.AVAILABLE);
    }

    private static MonthlyAnalyticsResponse emptyMonth(
            YearMonth month, LocalDate periodStart, LocalDate periodEnd) {
        MetricAggregateResponse emptyMetric = new MetricAggregateResponse(null, null, 0);
        List<GoalAttainmentResponse> attainment = java.util.Arrays.stream(dev.formetric.planning.NutrientType.values())
                .map(nutrient -> new GoalAttainmentResponse(nutrient, false, 0, 0, null))
                .toList();
        return new MonthlyAnalyticsResponse(
                month,
                periodStart,
                periodEnd,
                null,
                0,
                0,
                0,
                0,
                new MonthlyNutritionResponse(
                        emptyMetric, emptyMetric, emptyMetric, emptyMetric, emptyMetric, emptyMetric),
                new EnergySummaryResponse(null, null, null, null, 0, 0, 0, 0, 0, 0, null, null),
                attainment,
                new WorkoutSummaryResponse(0, 0, 0, null, List.of()),
                new WeightPeriodSummaryResponse(0, null, null, null, null, null),
                null,
                null);
    }

    private static NutritionValuesResponse nutrition(AnalyticsCalculations.DailyValues values) {
        return new NutritionValuesResponse(
                values.caloriesKcal(), values.proteinG(), values.carbohydrateG(),
                values.fatG(), values.fiberG(), values.waterMl());
    }

    private static MetricAggregateResponse aggregate(List<BigDecimal> values) {
        AnalyticsCalculations.MetricAggregate aggregate = AnalyticsCalculations.aggregate(values);
        return new MetricAggregateResponse(aggregate.total(), aggregate.average(), aggregate.sampleCount());
    }

    private static EnergySummaryResponse energyResponse(AnalyticsCalculations.EnergyAggregate energy) {
        return new EnergySummaryResponse(
                energy.netBalanceKcal(), energy.deficitMagnitudeKcal(), energy.surplusKcal(),
                energy.averageBalanceKcal(), energy.eligibleDays(), energy.missingTdeeDays(),
                energy.missingNutritionDays(),
                energy.deficitDays(), energy.surplusDays(), energy.neutralDays(),
                energyExtremeResponse(energy.largestDeficit()),
                energyExtremeResponse(energy.largestSurplus()));
    }

    private static EnergyExtremeResponse energyExtremeResponse(
            AnalyticsCalculations.EnergyExtreme extreme) {
        return extreme == null
                ? null
                : new EnergyExtremeResponse(extreme.date(), extreme.balanceKcal());
    }

    private static WorkoutSummaryResponse workoutSummary(List<WorkoutData> workouts, Integer elapsedDays) {
        int totalDuration = workouts.stream().mapToInt(WorkoutData::durationMinutes).sum();
        int trainingDays = Math.toIntExact(workouts.stream().map(WorkoutData::date).distinct().count());
        BigDecimal perWeek = elapsedDays == null || elapsedDays == 0
                ? null
                : BigDecimal.valueOf(workouts.size())
                        .multiply(BigDecimal.valueOf(7))
                        .divide(BigDecimal.valueOf(elapsedDays), MATH_CONTEXT)
                        .setScale(2, RoundingMode.HALF_UP);
        LinkedHashSet<String> modalities = new LinkedHashSet<>();
        workouts.forEach(workout -> modalities.add(
                workout.customModality() == null ? workout.modality().name() : workout.customModality()));
        return new WorkoutSummaryResponse(
                workouts.size(), trainingDays, totalDuration, perWeek, List.copyOf(modalities));
    }

    private static WeightPeriodSummaryResponse weightSummary(List<WeightData> weights) {
        if (weights.isEmpty()) {
            return new WeightPeriodSummaryResponse(0, null, null, null, null, null);
        }
        BigDecimal initial = AnalyticsCalculations.normalize(weights.getFirst().weightKg());
        BigDecimal latest = AnalyticsCalculations.normalize(weights.getLast().weightKg());
        BigDecimal minimum = weights.stream().map(WeightData::weightKg)
                .min(BigDecimal::compareTo).map(AnalyticsCalculations::normalize).orElseThrow();
        BigDecimal maximum = weights.stream().map(WeightData::weightKg)
                .max(BigDecimal::compareTo).map(AnalyticsCalculations::normalize).orElseThrow();
        return new WeightPeriodSummaryResponse(
                weights.size(), initial, latest,
                AnalyticsCalculations.normalize(latest.subtract(initial)), minimum, maximum);
    }

    private static ConsumptionExtremeResponse consumptionExtreme(
            List<DiaryDayData> diaryDays, boolean highest) {
        Comparator<DiaryDayData> byCaloriesThenDate = Comparator
                .comparing((DiaryDayData day) -> AnalyticsCalculations.historicalValues(day).caloriesKcal())
                .thenComparing(DiaryDayData::date);
        Comparator<DiaryDayData> selectionOrder = highest
                ? Comparator.comparing(
                                (DiaryDayData day) -> AnalyticsCalculations.historicalValues(day).caloriesKcal(),
                                Comparator.reverseOrder())
                        .thenComparing(DiaryDayData::date)
                : byCaloriesThenDate;
        Optional<DiaryDayData> selected = diaryDays.stream()
                .filter(day -> day.status() == DailyLogStatus.CLOSED)
                .filter(day -> AnalyticsCalculations.historicalValues(day).caloriesKcal() != null)
                .sorted(selectionOrder)
                .findFirst();
        return selected.map(day -> new ConsumptionExtremeResponse(
                        day.date(), AnalyticsCalculations.historicalValues(day).caloriesKcal()))
                .orElse(null);
    }

    private static List<LocalDate> dates(LocalDate from, LocalDate to) {
        List<LocalDate> dates = new ArrayList<>();
        LocalDate current = from;
        while (true) {
            dates.add(current);
            if (current.equals(to)) {
                return List.copyOf(dates);
            }
            current = current.plusDays(1);
        }
    }

    private static DiaryAnalyticsStatus status(DiaryDayData diary) {
        if (diary == null) {
            return DiaryAnalyticsStatus.MISSING;
        }
        return diary.status() == DailyLogStatus.CLOSED
                ? DiaryAnalyticsStatus.CLOSED
                : DiaryAnalyticsStatus.OPEN;
    }

    private static AnalyticsAvailability energyAvailability(DiaryDayData diary, BigDecimal tdee) {
        if (diary == null) {
            return AnalyticsAvailability.MISSING_LOG;
        }
        if (diary.status() == DailyLogStatus.OPEN) {
            return AnalyticsAvailability.OPEN_LOG;
        }
        if (AnalyticsCalculations.historicalValues(diary).caloriesKcal() == null) {
            return AnalyticsAvailability.MISSING_VALUE;
        }
        return tdee == null ? AnalyticsAvailability.MISSING_TDEE : AnalyticsAvailability.AVAILABLE;
    }

    private static String unit(AnalyticsMetric metric) {
        return switch (metric) {
            case CALORIES, ENERGY_BALANCE -> "kcal";
            case PROTEIN, CARBOHYDRATE, FAT, FIBER -> "g";
            case WATER -> "ml";
            case WEIGHT -> "kg";
        };
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(currentUserZoneIdProvider.requireCurrentUserZoneId()));
    }

    private static LocalDate min(LocalDate first, LocalDate second) {
        return first.isBefore(second) ? first : second;
    }
}

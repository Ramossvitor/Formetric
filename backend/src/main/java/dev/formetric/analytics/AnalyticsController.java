package dev.formetric.analytics;

import dev.formetric.planning.GoalBandClassifier;
import dev.formetric.planning.GoalTone;
import dev.formetric.planning.NutrientType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analytics")
@Tag(name = "Analytics", description = "Deterministic daily, monthly and time-series health analytics")
@Validated
class AnalyticsController {

    private final AnalyticsService analyticsService;

    AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/daily")
    @Operation(
            summary = "Read the deterministic snapshot for one day",
            description = "An OPEN diary is returned as a partial snapshot, but is not eligible for historical energy or monthly averages.")
    DailyAnalyticsResponse daily(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return analyticsService.daily(date);
    }

    @GetMapping("/monthly")
    @Operation(
            summary = "Calculate a calendar-month consolidation",
            description = "The current month ends today in the profile time zone. Future dates are never counted as missing.")
    MonthlyAnalyticsResponse monthly(
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        return analyticsService.monthly(month);
    }

    @GetMapping("/series")
    @Operation(
            summary = "Read an explicit-gap daily series",
            description = "The inclusive interval is limited to 366 days. Only CLOSED diaries supply historical nutrition and energy values.")
    AnalyticsSeriesResponse series(
            @RequestParam AnalyticsMetric metric,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return analyticsService.series(metric, from, to);
    }

    @GetMapping("/bounds")
    @Operation(summary = "Read the combined available date bounds for diary, workout and weight data")
    AnalyticsBoundsResponse bounds() {
        return analyticsService.bounds();
    }
}

record DailyAnalyticsResponse(
        LocalDate date,
        DiaryAnalyticsStatus diaryStatus,
        boolean fastingConfirmed,
        boolean historicalEligible,
        int foodItemCount,
        int waterEntryCount,
        NutritionValuesResponse nutrition,
        BigDecimal tdeeKcal,
        BigDecimal energyBalanceKcal,
        BigDecimal projectedEnergyBalanceKcal,
        AnalyticsAvailability energyBalanceAvailability,
        BigDecimal calorieTargetKcal,
        List<GoalProgressResponse> goalProgress,
        BigDecimal weightKg,
        WorkoutSummaryResponse workouts) {
}

record NutritionValuesResponse(
        BigDecimal caloriesKcal,
        BigDecimal proteinG,
        BigDecimal carbohydrateG,
        BigDecimal fatG,
        BigDecimal fiberG,
        BigDecimal waterMl) {
}

record GoalProgressResponse(
        NutrientType nutrient,
        BigDecimal value,
        String bandLabel,
        GoalTone bandTone,
        Boolean attained,
        GoalReferenceResponse reference) {
}

record GoalReferenceResponse(
        String label,
        BigDecimal minValue,
        BigDecimal maxValue,
        boolean minInclusive,
        boolean maxInclusive,
        BigDecimal remainingToRange,
        BigDecimal excessOverRange) {

    static GoalReferenceResponse from(GoalBandClassifier.GoalReference reference) {
        return reference == null
                ? null
                : new GoalReferenceResponse(
                        reference.label(),
                        reference.minValue(),
                        reference.maxValue(),
                        reference.minInclusive(),
                        reference.maxInclusive(),
                        reference.remainingToRange(),
                        reference.excessOverRange());
    }
}

record WorkoutSummaryResponse(
        int sessionCount,
        int trainingDays,
        int totalDurationMinutes,
        BigDecimal sessionsPerWeek,
        List<String> modalities) {
}

record MonthlyAnalyticsResponse(
        YearMonth month,
        LocalDate periodStart,
        LocalDate periodEnd,
        LocalDate throughDate,
        int elapsedCalendarDays,
        int closedDays,
        int openDays,
        int missingDiaryDays,
        MonthlyNutritionResponse nutrition,
        EnergySummaryResponse energy,
        List<GoalAttainmentResponse> goalAttainment,
        WorkoutSummaryResponse workouts,
        WeightPeriodSummaryResponse weight,
        ConsumptionExtremeResponse highestConsumption,
        ConsumptionExtremeResponse lowestConsumption) {
}

record MonthlyNutritionResponse(
        MetricAggregateResponse caloriesKcal,
        MetricAggregateResponse proteinG,
        MetricAggregateResponse carbohydrateG,
        MetricAggregateResponse fatG,
        MetricAggregateResponse fiberG,
        MetricAggregateResponse waterMl) {
}

record MetricAggregateResponse(BigDecimal total, BigDecimal average, int sampleCount) {
}

record EnergySummaryResponse(
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
        EnergyExtremeResponse largestDeficit,
        EnergyExtremeResponse largestSurplus) {
}

record EnergyExtremeResponse(LocalDate date, BigDecimal balanceKcal) {
}

record GoalAttainmentResponse(
        NutrientType nutrient,
        boolean configured,
        int attainedDays,
        int eligibleDays,
        BigDecimal attainedPercentage) {
}

record WeightPeriodSummaryResponse(
        int observationCount,
        BigDecimal initialWeightKg,
        BigDecimal finalWeightKg,
        BigDecimal changeKg,
        BigDecimal minimumWeightKg,
        BigDecimal maximumWeightKg) {
}

record ConsumptionExtremeResponse(LocalDate date, BigDecimal caloriesKcal) {
}

record AnalyticsSeriesResponse(
        AnalyticsMetric metric,
        String unit,
        LocalDate from,
        LocalDate to,
        List<AnalyticsSeriesPointResponse> points) {
}

record AnalyticsSeriesPointResponse(
        LocalDate date,
        BigDecimal value,
        AnalyticsAvailability availability) {
}

record AnalyticsBoundsResponse(LocalDate earliestDate, LocalDate latestDate, LocalDate today) {
}

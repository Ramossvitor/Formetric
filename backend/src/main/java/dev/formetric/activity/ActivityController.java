package dev.formetric.activity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workouts")
@Tag(name = "Workouts", description = "Physical activity sessions tracked independently from TDEE")
@Validated
class WorkoutController {

    private final ActivityService activityService;

    WorkoutController(ActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping
    @Operation(summary = "List workouts in an inclusive date range")
    List<WorkoutResponse> list(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return activityService.listWorkouts(from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Create a workout",
            description = "Estimated workout calories are informational and are never subtracted from energy balance.")
    WorkoutResponse create(@Valid @RequestBody CreateWorkoutRequest request) {
        return activityService.createWorkout(request);
    }

    @GetMapping("/{workoutId}")
    @ApiResponse(responseCode = "404", description = "Workout does not exist for the authenticated user")
    WorkoutResponse get(@PathVariable UUID workoutId) {
        return activityService.getWorkout(workoutId);
    }

    @PutMapping("/{workoutId}")
    WorkoutResponse update(
            @PathVariable UUID workoutId,
            @Valid @RequestBody UpdateWorkoutRequest request) {
        return activityService.updateWorkout(workoutId, request);
    }

    @DeleteMapping("/{workoutId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID workoutId) {
        activityService.deleteWorkout(workoutId);
    }
}

@RestController
@RequestMapping("/api/v1/weight-logs")
@Tag(name = "Weight history", description = "One official body-weight observation per calendar date")
@Validated
class WeightLogController {

    private final ActivityService activityService;

    WeightLogController(ActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping
    @Operation(summary = "List official weight observations in an inclusive date range")
    List<WeightLogResponse> list(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return activityService.listWeightLogs(from, to);
    }

    @GetMapping("/overview")
    @Operation(
            summary = "Calculate weight summary and trend",
            description = "Moving averages use observations inside the latest 7/14 civil days. Trend uses linear regression over up to 28 days and requires at least 3 observations.")
    WeightOverviewResponse overview(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return activityService.weightOverview(from, to);
    }

    @GetMapping("/{date}")
    @ApiResponse(responseCode = "404", description = "No official weight exists on this date")
    WeightLogResponse get(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return activityService.getWeightLog(date);
    }

    @PutMapping("/{date}")
    @Operation(
            summary = "Create or update the official weight for a date",
            description = "Omit version when creating. Send the current version when updating an existing observation.")
    WeightLogResponse upsert(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Valid @RequestBody UpsertWeightLogRequest request) {
        return activityService.upsertWeightLog(date, request);
    }

    @DeleteMapping("/{date}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        activityService.deleteWeightLog(date);
    }
}

record CreateWorkoutRequest(
        UUID requestId,
        @NotNull LocalDate date,
        @NotNull WorkoutModality modality,
        @Size(max = 80) String customModality,
        @NotBlank @Size(max = 120) String title,
        @NotNull @Size(max = 20) List<@NotBlank @Size(max = 50) String> muscleGroups,
        @Schema(example = "18:30:00") LocalTime startTime,
        @Min(1) @Max(1440) int durationMinutes,
        @DecimalMin("0") @DecimalMax("100000") @Digits(integer = 9, fraction = 3) BigDecimal estimatedKcal,
        @Size(max = 2000) String notes) {

    WorkoutDetails toDetails() {
        return new WorkoutDetails(
                date, modality, customModality, title, muscleGroups,
                startTime, durationMinutes, estimatedKcal, notes);
    }
}

record UpdateWorkoutRequest(
        @NotNull LocalDate date,
        @NotNull WorkoutModality modality,
        @Size(max = 80) String customModality,
        @NotBlank @Size(max = 120) String title,
        @NotNull @Size(max = 20) List<@NotBlank @Size(max = 50) String> muscleGroups,
        LocalTime startTime,
        @Min(1) @Max(1440) int durationMinutes,
        @DecimalMin("0") @DecimalMax("100000") @Digits(integer = 9, fraction = 3) BigDecimal estimatedKcal,
        @Size(max = 2000) String notes,
        @NotNull @PositiveOrZero Long version) {

    WorkoutDetails toDetails() {
        return new WorkoutDetails(
                date, modality, customModality, title, muscleGroups,
                startTime, durationMinutes, estimatedKcal, notes);
    }
}

record UpsertWeightLogRequest(
        @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("1000")
        @Digits(integer = 4, fraction = 3) BigDecimal weightKg,
        @NotNull @Schema(example = "08:10:00") LocalTime measuredAt,
        @Size(max = 120) String condition,
        @Size(max = 2000) String notes,
        @PositiveOrZero Long version) {

    WeightDetails toDetails() {
        return new WeightDetails(weightKg, measuredAt, condition, notes);
    }
}

record WorkoutResponse(
        UUID id,
        LocalDate date,
        WorkoutModality modality,
        String customModality,
        String title,
        List<String> muscleGroups,
        LocalTime startTime,
        int durationMinutes,
        BigDecimal estimatedKcal,
        String notes,
        Instant createdAt,
        Instant updatedAt,
        long version) {

    static WorkoutResponse from(Workout workout) {
        return new WorkoutResponse(
                workout.id(), workout.date(), workout.modality(), workout.customModality(), workout.title(),
                workout.muscleGroups(), workout.startTime(), workout.durationMinutes(), workout.estimatedKcal(),
                workout.notes(), workout.createdAt(), workout.updatedAt(), workout.version());
    }
}

record WeightLogResponse(
        LocalDate date,
        BigDecimal weightKg,
        LocalTime measuredAt,
        String condition,
        String notes,
        Instant createdAt,
        Instant updatedAt,
        long version) {

    static WeightLogResponse from(WeightLog log) {
        return new WeightLogResponse(
                log.date(), log.weightKg(), log.measuredAt(), log.condition(), log.notes(),
                log.createdAt(), log.updatedAt(), log.version());
    }
}

record WeightOverviewResponse(
        List<WeightLogResponse> entries,
        BigDecimal currentWeightKg,
        BigDecimal minimumWeightKg,
        BigDecimal maximumWeightKg,
        BigDecimal changeKg,
        WeightAverageResponse movingAverage7,
        WeightAverageResponse movingAverage14,
        WeightTrendResponse trend) {

    static WeightOverviewResponse from(List<WeightLog> entries, WeightOverviewMetrics metrics) {
        return new WeightOverviewResponse(
                entries.stream().map(WeightLogResponse::from).toList(),
                metrics.currentWeightKg(),
                metrics.minimumWeightKg(),
                metrics.maximumWeightKg(),
                metrics.changeKg(),
                WeightAverageResponse.from(metrics.movingAverage7()),
                WeightAverageResponse.from(metrics.movingAverage14()),
                WeightTrendResponse.from(metrics.trend()));
    }
}

record WeightAverageResponse(BigDecimal valueKg, int sampleCount) {
    static WeightAverageResponse from(WeightAverageMetric metric) {
        return metric == null ? null : new WeightAverageResponse(metric.valueKg(), metric.sampleCount());
    }
}

record WeightTrendResponse(BigDecimal kgPerWeek, int sampleCount, LocalDate from, LocalDate to) {
    static WeightTrendResponse from(WeightTrendMetric metric) {
        return metric == null
                ? null
                : new WeightTrendResponse(metric.kgPerWeek(), metric.sampleCount(), metric.from(), metric.to());
    }
}

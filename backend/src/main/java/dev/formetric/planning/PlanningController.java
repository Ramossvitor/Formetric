package dev.formetric.planning;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/nutrition-goal-periods")
@Tag(name = "Nutrition goals", description = "Versioned nutritional targets and classification bands")
@Validated
class NutritionGoalPeriodController {

    private final PlanningService planningService;

    NutritionGoalPeriodController(PlanningService planningService) {
        this.planningService = planningService;
    }

    @GetMapping
    @Operation(summary = "List nutritional goal periods in chronological order")
    List<NutritionGoalPeriodResponse> list() {
        return planningService.listNutritionGoalPeriods();
    }

    @GetMapping("/effective")
    @Operation(summary = "Find the nutritional goal period effective on a date")
    @ApiResponse(responseCode = "404", description = "No period covers the requested date")
    NutritionGoalPeriodResponse effective(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Schema(example = "2026-08-12") LocalDate date) {
        return planningService.effectiveNutritionGoalPeriod(date);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Append a nutritional goal period",
            description = "Historical periods are immutable. Appending a current or future period may close the preceding open period.")
    @ApiResponse(responseCode = "409", description = "The requested validity overlaps an existing period")
    NutritionGoalPeriodResponse create(@Valid @RequestBody CreateNutritionGoalPeriodRequest request) {
        return planningService.createNutritionGoalPeriod(request);
    }
}

@RestController
@RequestMapping("/api/v1/tdee-periods")
@Tag(name = "TDEE", description = "Versioned total daily energy expenditure estimates")
@Validated
class TdeePeriodController {

    private final PlanningService planningService;

    TdeePeriodController(PlanningService planningService) {
        this.planningService = planningService;
    }

    @GetMapping
    @Operation(summary = "List TDEE periods in chronological order")
    List<TdeePeriodResponse> list() {
        return planningService.listTdeePeriods();
    }

    @GetMapping("/effective")
    @Operation(summary = "Find the TDEE effective on a date")
    @ApiResponse(responseCode = "404", description = "No period covers the requested date")
    TdeePeriodResponse effective(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Schema(example = "2026-08-12") LocalDate date) {
        return planningService.effectiveTdeePeriod(date);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Append a TDEE period",
            description = "Historical periods are immutable. Appending a current or future period may close the preceding open period.")
    @ApiResponse(responseCode = "409", description = "The requested validity overlaps an existing period")
    TdeePeriodResponse create(@Valid @RequestBody CreateTdeePeriodRequest request) {
        return planningService.createTdeePeriod(request);
    }
}

record CreateNutritionGoalPeriodRequest(
        @NotNull @Schema(example = "2026-08-01", description = "Inclusive start date") LocalDate validFrom,
        @Schema(example = "2026-09-01", description = "Exclusive end date; null means open-ended") LocalDate validTo,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 9, fraction = 3)
        @Schema(example = "2500.000", nullable = true) BigDecimal calorieTarget,
        @NotNull @Size(max = 6) @Valid List<NutrientTargetRequest> targets) {
}

record NutrientTargetRequest(
        @NotNull NutrientType nutrient,
        @NotNull NutritionUnit unit,
        @NotNull @Size(min = 1, max = 20) @Valid List<GoalBandRequest> bands) {

    NutrientTargetDefinition toDefinition() {
        return new NutrientTargetDefinition(
                nutrient,
                unit,
                bands.stream().map(GoalBandRequest::toDefinition).toList());
    }
}

record GoalBandRequest(
        @jakarta.validation.constraints.PositiveOrZero int position,
        @DecimalMin("0") @Digits(integer = 9, fraction = 3)
        @Schema(nullable = true, example = "175.000") BigDecimal minValue,
        @DecimalMin("0") @Digits(integer = 9, fraction = 3)
        @Schema(nullable = true, example = "189.000") BigDecimal maxValue,
        @NotNull @Schema(description = "Whether the minimum boundary belongs to the band") Boolean minInclusive,
        @NotNull @Schema(description = "Whether the maximum boundary belongs to the band") Boolean maxInclusive,
        @NotBlank @Size(max = 40) @Schema(example = "Meta") String label,
        @NotNull GoalTone tone,
        @NotNull @Schema(description = "Whether values in this band count as attaining the configured goal")
        Boolean countsAsAttained) {

    GoalBandDefinition toDefinition() {
        return new GoalBandDefinition(
                position, minValue, maxValue, minInclusive, maxInclusive, label, tone, countsAsAttained);
    }
}

record CreateTdeePeriodRequest(
        @NotNull @Schema(example = "2026-08-01", description = "Inclusive start date") LocalDate validFrom,
        @Schema(example = "2026-09-01", description = "Exclusive end date; null means open-ended") LocalDate validTo,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 9, fraction = 3)
        @Schema(example = "3000.000", description = "Estimated energy expenditure in kcal/day") BigDecimal kcalPerDay) {
}

record NutritionGoalPeriodResponse(
        UUID id,
        LocalDate validFrom,
        LocalDate validTo,
        BigDecimal calorieTarget,
        List<NutrientTargetResponse> targets,
        Instant createdAt,
        Instant updatedAt) {

    static NutritionGoalPeriodResponse from(NutritionGoalPeriod period) {
        return new NutritionGoalPeriodResponse(
                period.id(),
                period.validFrom(),
                period.validTo(),
                period.calorieTarget(),
                period.nutrientTargets().stream().map(NutrientTargetResponse::from).toList(),
                period.createdAt(),
                period.updatedAt());
    }
}

record NutrientTargetResponse(
        NutrientType nutrient,
        NutritionUnit unit,
        List<GoalBandResponse> bands) {

    static NutrientTargetResponse from(NutrientTarget target) {
        return new NutrientTargetResponse(
                target.nutrient(),
                target.unit(),
                target.bands().stream().map(GoalBandResponse::from).toList());
    }
}

record GoalBandResponse(
        int position,
        BigDecimal minValue,
        BigDecimal maxValue,
        boolean minInclusive,
        boolean maxInclusive,
        String label,
        GoalTone tone,
        boolean countsAsAttained) {

    static GoalBandResponse from(GoalBand band) {
        return new GoalBandResponse(
                band.position(),
                band.minimum(),
                band.maximum(),
                band.minimumInclusive(),
                band.maximumInclusive(),
                band.label(),
                band.tone(),
                band.countsAsAttained());
    }
}

record TdeePeriodResponse(
        UUID id,
        LocalDate validFrom,
        LocalDate validTo,
        BigDecimal kcalPerDay,
        Instant createdAt,
        Instant updatedAt) {

    static TdeePeriodResponse from(TdeePeriod period) {
        return new TdeePeriodResponse(
                period.id(),
                period.validFrom(),
                period.validTo(),
                period.kcalPerDay(),
                period.createdAt(),
                period.updatedAt());
    }
}

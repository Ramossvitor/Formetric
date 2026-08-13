package dev.formetric.diary;

import dev.formetric.catalog.CatalogItemType;
import dev.formetric.catalog.CatalogUnit;
import dev.formetric.planning.PlanningDataProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/daily-logs/{date}")
@Tag(name = "Daily diary", description = "Food, meals and water tracked for a calendar date")
class DiaryController {

    private final DiaryService diaryService;

    DiaryController(DiaryService diaryService) {
        this.diaryService = diaryService;
    }

    @GetMapping
    @Operation(summary = "Read a daily diary with calculated totals and energy balance")
    @ApiResponse(responseCode = "404", description = "No diary exists for the date")
    DailyLogResponse get(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return diaryService.get(date);
    }

    @PostMapping("/meals")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a meal, creating the daily diary when necessary")
    DailyLogResponse addMeal(@PathVariable LocalDate date, @Valid @RequestBody CreateMealRequest request) {
        return diaryService.addMeal(date, request);
    }

    @PatchMapping("/meals/{mealId}")
    DailyLogResponse updateMeal(
            @PathVariable LocalDate date, @PathVariable UUID mealId, @Valid @RequestBody UpdateMealRequest request) {
        return diaryService.updateMeal(date, mealId, request);
    }

    @DeleteMapping("/meals/{mealId}")
    DailyLogResponse deleteMeal(@PathVariable LocalDate date, @PathVariable UUID mealId) {
        return diaryService.deleteMeal(date, mealId);
    }

    @PutMapping("/meals/reorder")
    DailyLogResponse reorderMeals(@PathVariable LocalDate date, @Valid @RequestBody ReorderRequest request) {
        return diaryService.reorderMeals(date, request);
    }

    @PostMapping("/meals/{mealId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Resolve a catalog version and store an immutable nutritional snapshot")
    DailyLogResponse addItem(
            @PathVariable LocalDate date,
            @PathVariable UUID mealId,
            @Valid @RequestBody UpsertMealItemRequest request) {
        return diaryService.addItem(date, mealId, request);
    }

    @PutMapping("/meals/{mealId}/items/{itemId}")
    DailyLogResponse updateItem(
            @PathVariable LocalDate date,
            @PathVariable UUID mealId,
            @PathVariable UUID itemId,
            @Valid @RequestBody UpsertMealItemRequest request) {
        return diaryService.updateItem(date, mealId, itemId, request);
    }

    @DeleteMapping("/meals/{mealId}/items/{itemId}")
    DailyLogResponse deleteItem(
            @PathVariable LocalDate date, @PathVariable UUID mealId, @PathVariable UUID itemId) {
        return diaryService.deleteItem(date, mealId, itemId);
    }

    @PutMapping("/meals/{mealId}/items/reorder")
    DailyLogResponse reorderItems(
            @PathVariable LocalDate date, @PathVariable UUID mealId, @Valid @RequestBody ReorderRequest request) {
        return diaryService.reorderItems(date, mealId, request);
    }

    @PostMapping("/water")
    @ResponseStatus(HttpStatus.CREATED)
    DailyLogResponse addWater(@PathVariable LocalDate date, @Valid @RequestBody CreateWaterRequest request) {
        return diaryService.addWater(date, request);
    }

    @PutMapping("/water/{waterId}")
    DailyLogResponse updateWater(
            @PathVariable LocalDate date, @PathVariable UUID waterId, @Valid @RequestBody UpdateWaterRequest request) {
        return diaryService.updateWater(date, waterId, request);
    }

    @DeleteMapping("/water/{waterId}")
    DailyLogResponse deleteWater(@PathVariable LocalDate date, @PathVariable UUID waterId) {
        return diaryService.deleteWater(date, waterId);
    }

    @PostMapping("/close")
    @Operation(summary = "Close the diary", description = "An empty diary requires explicit fasting confirmation.")
    DailyLogResponse close(@PathVariable LocalDate date, @Valid @RequestBody CloseDailyLogRequest request) {
        return diaryService.close(date, request);
    }

    @PostMapping("/reopen")
    DailyLogResponse reopen(@PathVariable LocalDate date) {
        return diaryService.reopen(date);
    }

    @PostMapping("/meals/copy")
    @ResponseStatus(HttpStatus.CREATED)
    DailyLogResponse copyMeal(@PathVariable LocalDate date, @Valid @RequestBody CopyMealRequest request) {
        return diaryService.copyMeal(date, request);
    }

    @PostMapping("/copy")
    @ResponseStatus(HttpStatus.CREATED)
    DailyLogResponse copyDay(@PathVariable LocalDate date, @Valid @RequestBody CopyDayRequest request) {
        return diaryService.copyDay(date, request);
    }
}

record CreateMealRequest(
        @NotBlank @Size(max = 80) String name,
        @PositiveOrZero Integer position,
        @Schema(example = "12:30:00") LocalTime mealTime,
        UUID requestId) {}

record UpdateMealRequest(
        @NotBlank @Size(max = 80) String name,
        @PositiveOrZero Integer position,
        LocalTime mealTime) {}

record UpsertMealItemRequest(
        @NotNull CatalogItemType itemType,
        @NotNull UUID versionId,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 11, fraction = 3) BigDecimal quantity,
        @NotNull CatalogUnit unit,
        UUID servingOptionId,
        @PositiveOrZero Integer position,
        DataQuality dataQuality,
        @DecimalMin("0") @Digits(integer = 11, fraction = 3) BigDecimal uncertaintyKcal,
        UUID requestId) {}

record CreateWaterRequest(
        @NotNull Instant loggedAt,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 9, fraction = 3) BigDecimal volumeMl,
        UUID requestId) {}

record UpdateWaterRequest(
        @NotNull Instant loggedAt,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 9, fraction = 3) BigDecimal volumeMl) {}

record CloseDailyLogRequest(boolean fastingConfirmed) {}

record ReorderRequest(@NotEmpty List<@NotNull UUID> ids) {}

record CopyMealRequest(
        @NotNull LocalDate sourceDate,
        @NotNull UUID sourceMealId,
        UUID requestId) {}

record CopyDayRequest(@NotNull LocalDate sourceDate, UUID requestId) {}

record DailyLogResponse(
        UUID id,
        LocalDate date,
        DailyLogStatus status,
        List<MealResponse> meals,
        List<WaterLogResponse> waterLogs,
        BigDecimal waterTotalMl,
        DiaryTotals totals,
        BigDecimal tdeeKcal,
        BigDecimal energyBalanceKcal,
        String energyBalanceAvailability,
        PlanningDataProvider.EffectiveNutritionGoals nutritionGoals,
        Instant createdAt,
        Instant updatedAt,
        Instant closedAt,
        List<DailyLogStateEventResponse> stateEvents) {

    static DailyLogResponse from(
            DailyLog log,
            BigDecimal tdee,
            PlanningDataProvider.EffectiveNutritionGoals nutritionGoals) {
        DiaryTotals totals = DiaryTotals.forMeals(log.meals());
        BigDecimal waterTotal = log.waterLogs().stream().map(WaterLog::volumeMl)
                .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(3, RoundingMode.HALF_UP);
        BigDecimal balance = tdee == null ? null : totals.kcal().subtract(tdee).setScale(3, RoundingMode.HALF_UP);
        return new DailyLogResponse(
                log.id(), log.date(), log.status(), log.meals().stream().map(MealResponse::from).toList(),
                log.waterLogs().stream().map(WaterLogResponse::from).toList(), waterTotal, totals, tdee, balance,
                tdee == null ? "UNAVAILABLE" : "AVAILABLE", nutritionGoals,
                log.createdAt(), log.updatedAt(), log.closedAt(),
                log.stateEvents().stream().map(DailyLogStateEventResponse::from).toList());
    }
}

record MealResponse(UUID id, String name, int position, LocalTime mealTime, List<MealItemResponse> items, DiaryTotals totals) {
    static MealResponse from(Meal meal) {
        return new MealResponse(meal.id(), meal.name(), meal.position(), meal.mealTime(),
                meal.items().stream().map(MealItemResponse::from).toList(), DiaryTotals.forItems(meal.items()));
    }
}

record MealItemResponse(
        UUID id, CatalogItemType itemType, UUID versionId, UUID servingOptionId, int position,
        BigDecimal quantity, String unit, BigDecimal equivalentBasisQuantity, BigDecimal basisQuantity, String basisUnit,
        BigDecimal conversionFactor, String name, BigDecimal kcal, BigDecimal proteinG,
        BigDecimal carbohydrateG, BigDecimal fatG, BigDecimal fiberG, BigDecimal sodiumMg,
        DataQuality dataQuality, BigDecimal uncertaintyKcal) {
    static MealItemResponse from(MealItem item) {
        return new MealItemResponse(item.id(), item.itemType(), item.versionId(), item.servingOptionId(), item.position(),
                item.quantity(), item.quantityUnit(), item.equivalentBasisQuantity(), item.basisQuantity(),
                item.baseUnit(), item.conversionFactor(),
                item.name(), item.kcal(), item.proteinG(), item.carbohydrateG(), item.fatG(), item.fiberG(),
                item.sodiumMg(), item.dataQuality(), item.uncertaintyKcal());
    }
}

record WaterLogResponse(UUID id, Instant loggedAt, BigDecimal volumeMl) {
    static WaterLogResponse from(WaterLog log) { return new WaterLogResponse(log.id(), log.loggedAt(), log.volumeMl()); }
}

record DailyLogStateEventResponse(String type, boolean fastingConfirmed, UUID actorUserId, Instant occurredAt) {
    static DailyLogStateEventResponse from(DailyLogStateEvent event) {
        return new DailyLogStateEventResponse(
                event.eventType().name(), event.fastingConfirmed(), event.actorUserId(), event.occurredAt());
    }
}

package dev.formetric.catalog;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
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
@RequestMapping("/api/v1/foods")
@Tag(name = "Foods", description = "Private and global food catalog with immutable nutritional versions")
@Validated
class FoodController {
    private final CatalogService service;
    FoodController(CatalogService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "List or tolerantly search visible foods")
    CatalogPageResponse<FoodSummaryResponse> list(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "false") boolean favorite,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return CatalogPageResponse.foods(service.listFoods(query, favorite, includeArchived, page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a food and all immutable versions")
    FoodDetailResponse get(@PathVariable UUID id) {
        return FoodDetailResponse.from(service.getFood(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a user-owned food and its first version")
    @ApiResponse(responseCode = "400", description = "SYSTEM origin is reserved for managed global data")
    FoodDetailResponse create(@Valid @RequestBody CreateFoodRequest request) {
        return FoodDetailResponse.from(service.createFood(
                request.origin(), request.externalSource(), request.externalId(), request.toDefinition()));
    }

    @PostMapping("/{id}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Append an immutable nutritional version")
    FoodDetailResponse createVersion(
            @PathVariable UUID id, @Valid @RequestBody CreateFoodVersionRequest request) {
        return FoodDetailResponse.from(service.addFoodVersion(id, request.toDefinition()));
    }

    @PutMapping("/{id}/favorite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Add a food to the current user's favorites")
    void favorite(@PathVariable UUID id) { service.favoriteFood(id, true); }

    @DeleteMapping("/{id}/favorite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove a food from the current user's favorites")
    void unfavorite(@PathVariable UUID id) { service.favoriteFood(id, false); }

    @PostMapping("/{id}/archive")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Archive a user-owned food without deleting history")
    void archive(@PathVariable UUID id) { service.archiveFood(id, true); }

    @DeleteMapping("/{id}/archive")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Restore an archived user-owned food")
    void restore(@PathVariable UUID id) { service.archiveFood(id, false); }
}

@RestController
@RequestMapping("/api/v1/recipes")
@Tag(name = "Recipes", description = "Versioned recipes calculated from immutable food versions")
@Validated
class RecipeController {
    private final CatalogService service;
    RecipeController(CatalogService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "List or tolerantly search recipes")
    CatalogPageResponse<RecipeSummaryResponse> list(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "false") boolean favorite,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return CatalogPageResponse.recipes(service.listRecipes(query, favorite, includeArchived, page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a recipe and all immutable versions")
    RecipeDetailResponse get(@PathVariable UUID id) {
        return RecipeDetailResponse.from(service.getRecipe(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Create a recipe and its first version",
            description = "MVP ingredients reference food versions only. This deliberately prevents recursive recipe cycles.")
    RecipeDetailResponse create(@Valid @RequestBody CreateRecipeVersionRequest request) {
        return RecipeDetailResponse.from(service.createRecipe(request.toDefinition()));
    }

    @PostMapping("/{id}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Append an immutable recipe version")
    RecipeDetailResponse createVersion(
            @PathVariable UUID id, @Valid @RequestBody CreateRecipeVersionRequest request) {
        return RecipeDetailResponse.from(service.addRecipeVersion(id, request.toDefinition()));
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Duplicate the current recipe version under a new stable identity")
    RecipeDetailResponse duplicate(@PathVariable UUID id) {
        return RecipeDetailResponse.from(service.duplicateRecipe(id));
    }

    @PutMapping("/{id}/favorite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void favorite(@PathVariable UUID id) { service.favoriteRecipe(id, true); }

    @DeleteMapping("/{id}/favorite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unfavorite(@PathVariable UUID id) { service.favoriteRecipe(id, false); }

    @PostMapping("/{id}/archive")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void archive(@PathVariable UUID id) { service.archiveRecipe(id, true); }

    @DeleteMapping("/{id}/archive")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void restore(@PathVariable UUID id) { service.archiveRecipe(id, false); }
}

record CreateFoodRequest(
        @NotNull FoodOrigin origin,
        @Size(max = 80) String externalSource,
        @Size(max = 160) String externalId,
        @NotBlank @Size(max = 160) String name,
        @Size(max = 120) String brand,
        @Size(max = 1000) String notes,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal referenceQuantity,
        @NotNull CatalogUnit referenceUnit,
        @NotNull @DecimalMin("0") BigDecimal caloriesKcal,
        @NotNull @DecimalMin("0") BigDecimal proteinG,
        @NotNull @DecimalMin("0") BigDecimal carbohydrateG,
        @NotNull @DecimalMin("0") BigDecimal fatG,
        @NotNull @DecimalMin("0") BigDecimal fiberG,
        @DecimalMin("0") BigDecimal sodiumMg,
        @NotNull NutritionQuality quality,
        @DecimalMin("0") BigDecimal kcalUncertainty,
        @NotNull @Size(max = 30) @Valid List<ServingRequest> servings) {
    FoodVersionDefinition toDefinition() {
        return new FoodVersionDefinition(name, brand, notes, referenceQuantity, referenceUnit,
                caloriesKcal, proteinG, carbohydrateG, fatG, fiberG, sodiumMg, quality,
                kcalUncertainty, servings.stream().map(ServingRequest::toDefinition).toList());
    }
}

record CreateFoodVersionRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 120) String brand,
        @Size(max = 1000) String notes,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal referenceQuantity,
        @NotNull CatalogUnit referenceUnit,
        @NotNull @DecimalMin("0") BigDecimal caloriesKcal,
        @NotNull @DecimalMin("0") BigDecimal proteinG,
        @NotNull @DecimalMin("0") BigDecimal carbohydrateG,
        @NotNull @DecimalMin("0") BigDecimal fatG,
        @NotNull @DecimalMin("0") BigDecimal fiberG,
        @DecimalMin("0") BigDecimal sodiumMg,
        @NotNull NutritionQuality quality,
        @DecimalMin("0") BigDecimal kcalUncertainty,
        @NotNull @Size(max = 30) @Valid List<ServingRequest> servings) {
    FoodVersionDefinition toDefinition() {
        return new FoodVersionDefinition(name, brand, notes, referenceQuantity, referenceUnit,
                caloriesKcal, proteinG, carbohydrateG, fatG, fiberG, sodiumMg, quality,
                kcalUncertainty, servings.stream().map(ServingRequest::toDefinition).toList());
    }
}

record ServingRequest(
        @NotBlank @Size(max = 80) String label,
        @NotNull CatalogUnit unit,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal quantity,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal referenceQuantityEquivalent) {
    ServingDefinition toDefinition() {
        return new ServingDefinition(label.strip(), unit, quantity, referenceQuantityEquivalent);
    }
}

record CreateRecipeVersionRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 1000) String notes,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal yieldQuantity,
        @NotNull CatalogUnit yieldUnit,
        @DecimalMin(value = "0", inclusive = false) BigDecimal servingQuantity,
        @NotNull @Size(min = 1, max = 100) @Valid List<RecipeIngredientRequest> ingredients) {
    RecipeVersionDefinition toDefinition() {
        return new RecipeVersionDefinition(name, notes, yieldQuantity, yieldUnit, servingQuantity,
                ingredients.stream().map(RecipeIngredientRequest::toDefinition).toList());
    }
}

record RecipeIngredientRequest(
        @NotNull UUID foodVersionId,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal quantity,
        @NotNull CatalogUnit unit,
        UUID servingOptionId,
        @DecimalMin(value = "0", inclusive = false) BigDecimal referenceQuantityEquivalent) {
    RecipeIngredientDefinition toDefinition() {
        return new RecipeIngredientDefinition(
                foodVersionId, quantity, unit, servingOptionId, referenceQuantityEquivalent);
    }
}

record CatalogPageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    static CatalogPageResponse<FoodSummaryResponse> foods(CatalogPage<FoodView> page) {
        return new CatalogPageResponse<>(page.content().stream().map(FoodSummaryResponse::from).toList(),
                page.page(), page.size(), page.totalElements(), page.totalPages());
    }
    static CatalogPageResponse<RecipeSummaryResponse> recipes(CatalogPage<RecipeView> page) {
        return new CatalogPageResponse<>(page.content().stream().map(RecipeSummaryResponse::from).toList(),
                page.page(), page.size(), page.totalElements(), page.totalPages());
    }
}

record FoodSummaryResponse(
        UUID id, FoodOrigin origin, String externalSource, String externalId, boolean archived,
        boolean favorite, FoodVersionResponse currentVersion, Instant createdAt, Instant updatedAt) {
    static FoodSummaryResponse from(FoodView view) {
        FoodItem food = view.food();
        return new FoodSummaryResponse(food.id(), food.origin(), food.externalSource(), food.externalId(),
                food.archived(), view.favorite(), FoodVersionResponse.from(view.currentVersion()),
                food.createdAt(), food.updatedAt());
    }
}

record FoodDetailResponse(
        UUID id, FoodOrigin origin, String externalSource, String externalId, boolean archived,
        boolean favorite, FoodVersionResponse currentVersion, List<FoodVersionResponse> versions,
        Instant createdAt, Instant updatedAt) {
    static FoodDetailResponse from(FoodView view) {
        FoodItem food = view.food();
        return new FoodDetailResponse(food.id(), food.origin(), food.externalSource(), food.externalId(),
                food.archived(), view.favorite(), FoodVersionResponse.from(view.currentVersion()),
                view.versions().stream().map(FoodVersionResponse::from).toList(),
                food.createdAt(), food.updatedAt());
    }
}

record FoodVersionResponse(
        UUID id, int versionNumber, String name, String brand, String notes,
        BigDecimal referenceQuantity, CatalogUnit referenceUnit,
        BigDecimal caloriesKcal, BigDecimal proteinG, BigDecimal carbohydrateG,
        BigDecimal fatG, BigDecimal fiberG, BigDecimal sodiumMg,
        NutritionQuality quality, BigDecimal kcalUncertainty,
        List<ServingResponse> servings, Instant createdAt) {
    static FoodVersionResponse from(FoodVersion version) {
        return new FoodVersionResponse(version.id(), version.versionNumber(), version.name(), version.brand(),
                version.notes(), version.referenceQuantity(), version.referenceUnit(), version.caloriesKcal(),
                version.proteinG(), version.carbohydrateG(), version.fatG(), version.fiberG(), version.sodiumMg(),
                version.quality(), version.kcalUncertainty(),
                version.servings().stream().map(ServingResponse::from).toList(), version.createdAt());
    }
}

record ServingResponse(
        UUID id, int position, String label, CatalogUnit unit,
        BigDecimal quantity, BigDecimal referenceQuantityEquivalent) {
    static ServingResponse from(FoodServingOption serving) {
        return new ServingResponse(serving.id(), serving.position(), serving.label(), serving.unit(),
                serving.quantity(), serving.referenceQuantityEquivalent());
    }
}

record RecipeSummaryResponse(
        UUID id, boolean archived, boolean favorite, RecipeVersionResponse currentVersion,
        Instant createdAt, Instant updatedAt) {
    static RecipeSummaryResponse from(RecipeView view) {
        Recipe recipe = view.recipe();
        return new RecipeSummaryResponse(recipe.id(), recipe.archived(), view.favorite(),
                RecipeVersionResponse.from(view.currentVersion()), recipe.createdAt(), recipe.updatedAt());
    }
}

record RecipeDetailResponse(
        UUID id, boolean archived, boolean favorite, RecipeVersionResponse currentVersion,
        List<RecipeVersionResponse> versions, Instant createdAt, Instant updatedAt) {
    static RecipeDetailResponse from(RecipeView view) {
        Recipe recipe = view.recipe();
        return new RecipeDetailResponse(recipe.id(), recipe.archived(), view.favorite(),
                RecipeVersionResponse.from(view.currentVersion()),
                view.versions().stream().map(RecipeVersionResponse::from).toList(),
                recipe.createdAt(), recipe.updatedAt());
    }
}

record RecipeVersionResponse(
        UUID id, int versionNumber, String name, String notes,
        BigDecimal yieldQuantity, CatalogUnit yieldUnit, BigDecimal servingQuantity,
        List<RecipeIngredientResponse> ingredients,
        NutrientAmounts totalNutrition, NutrientAmounts per100gNutrition,
        NutrientAmounts perServingNutrition, NutritionQuality quality,
        BigDecimal kcalUncertainty, Instant createdAt) {
    static RecipeVersionResponse from(RecipeVersion version) {
        RecipeNutrition nutrition = CatalogCalculations.calculate(version);
        return new RecipeVersionResponse(version.id(), version.versionNumber(), version.name(), version.notes(),
                version.yieldQuantity(), version.yieldUnit(), version.servingQuantity(),
                version.ingredients().stream().map(RecipeIngredientResponse::from).toList(),
                nutrition.total(), nutrition.per100g(), nutrition.perServing(), nutrition.quality(),
                nutrition.kcalUncertainty(), version.createdAt());
    }
}

record RecipeIngredientResponse(
        int position, UUID foodVersionId, String foodName,
        BigDecimal quantity, CatalogUnit unit, UUID servingOptionId,
        BigDecimal referenceQuantityEquivalent, NutrientAmounts nutrients) {
    static RecipeIngredientResponse from(RecipeIngredient ingredient) {
        return new RecipeIngredientResponse(ingredient.position(), ingredient.foodVersion().id(),
                ingredient.foodVersion().name(), ingredient.quantity(), ingredient.unit(),
                ingredient.servingOptionId(), ingredient.referenceQuantityEquivalent(), ingredient.nutrients());
    }
}

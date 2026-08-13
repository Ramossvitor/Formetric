package dev.formetric.catalog;

import dev.formetric.identity.CurrentUserProvider;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
class CatalogService {

    private final CurrentUserProvider currentUserProvider;
    private final FoodItemRepository foodRepository;
    private final FoodVersionRepository foodVersionRepository;
    private final FoodFavoriteRepository foodFavoriteRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeVersionRepository recipeVersionRepository;
    private final RecipeFavoriteRepository recipeFavoriteRepository;
    private final Clock clock;

    CatalogService(
            CurrentUserProvider currentUserProvider,
            FoodItemRepository foodRepository,
            FoodVersionRepository foodVersionRepository,
            FoodFavoriteRepository foodFavoriteRepository,
            RecipeRepository recipeRepository,
            RecipeVersionRepository recipeVersionRepository,
            RecipeFavoriteRepository recipeFavoriteRepository,
            Clock clock) {
        this.currentUserProvider = currentUserProvider;
        this.foodRepository = foodRepository;
        this.foodVersionRepository = foodVersionRepository;
        this.foodFavoriteRepository = foodFavoriteRepository;
        this.recipeRepository = recipeRepository;
        this.recipeVersionRepository = recipeVersionRepository;
        this.recipeFavoriteRepository = recipeFavoriteRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    CatalogPage<FoodView> listFoods(
            String query, boolean favoriteOnly, boolean includeArchived, int page, int size) {
        UUID userId = userId();
        String safeQuery = validateSearch(query);
        Page<FoodItem> result = foodRepository.search(
                userId, safeQuery == null ? "" : safeQuery, safeQuery != null,
                favoriteOnly, includeArchived, PageRequest.of(page, size));
        Set<UUID> favorites = foodFavorites(userId, result.getContent().stream().map(FoodItem::id).toList());
        return CatalogPage.from(result, food -> {
            initializeFood(food);
            return new FoodView(food, favorites.contains(food.id()));
        });
    }

    @Transactional(readOnly = true)
    FoodView getFood(UUID id) {
        UUID userId = userId();
        FoodItem food = requireVisibleFood(id, userId);
        initializeFood(food);
        return new FoodView(food, foodFavoriteRepository.existsByUserIdAndFoodId(userId, id));
    }

    FoodView createFood(
            FoodOrigin origin,
            String externalSource,
            String externalId,
            FoodVersionDefinition definition) {
        UUID userId = userId();
        validateOrigin(origin, externalSource, externalId);
        FoodVersionDefinition normalized = normalize(definition);
        Instant now = clock.instant();
        FoodItem food = new FoodItem(
                userId,
                origin,
                stripToNull(externalSource),
                stripToNull(externalId),
                now);
        food.addVersion(new FoodVersion(food, 1, normalized, now), now);
        return new FoodView(foodRepository.save(food), false);
    }

    FoodView addFoodVersion(UUID id, FoodVersionDefinition definition) {
        UUID userId = userId();
        FoodItem food = foodRepository.findOwnedByIdForUpdate(id, userId)
                .orElseThrow(() -> new CatalogNotFoundException("Alimento não encontrado."));
        Instant now = clock.instant();
        food.addVersion(new FoodVersion(food, food.nextVersionNumber(), normalize(definition), now), now);
        foodRepository.save(food);
        return new FoodView(food, foodFavoriteRepository.existsByUserIdAndFoodId(userId, id));
    }

    void favoriteFood(UUID id, boolean favorite) {
        UUID userId = userId();
        requireVisibleFood(id, userId);
        if (favorite) {
            if (!foodFavoriteRepository.existsByUserIdAndFoodId(userId, id)) {
                foodFavoriteRepository.save(new FoodFavorite(userId, id, clock.instant()));
            }
        } else {
            foodFavoriteRepository.deleteByUserIdAndFoodId(userId, id);
        }
    }

    void archiveFood(UUID id, boolean archived) {
        FoodItem food = foodRepository.findOwnedByIdForUpdate(id, userId())
                .orElseThrow(() -> new CatalogNotFoundException("Alimento não encontrado."));
        food.setArchived(archived, clock.instant());
    }

    @Transactional(readOnly = true)
    CatalogPage<RecipeView> listRecipes(
            String query, boolean favoriteOnly, boolean includeArchived, int page, int size) {
        UUID userId = userId();
        String safeQuery = validateSearch(query);
        Page<Recipe> result = recipeRepository.search(
                userId, safeQuery == null ? "" : safeQuery, safeQuery != null,
                favoriteOnly, includeArchived, PageRequest.of(page, size));
        Set<UUID> favorites = recipeFavorites(userId, result.getContent().stream().map(Recipe::id).toList());
        return CatalogPage.from(result, recipe -> {
            initializeRecipe(recipe);
            return new RecipeView(recipe, favorites.contains(recipe.id()));
        });
    }

    @Transactional(readOnly = true)
    RecipeView getRecipe(UUID id) {
        UUID userId = userId();
        Recipe recipe = requireRecipe(id, userId);
        initializeRecipe(recipe);
        return new RecipeView(recipe, recipeFavoriteRepository.existsByUserIdAndRecipeId(userId, id));
    }

    RecipeView createRecipe(RecipeVersionDefinition definition) {
        UUID userId = userId();
        RecipeVersionDefinition normalized = normalize(definition);
        Instant now = clock.instant();
        Recipe recipe = new Recipe(userId, now);
        RecipeVersion version = buildRecipeVersion(recipe, 1, normalized, userId, now);
        recipe.addVersion(version, now);
        return new RecipeView(recipeRepository.save(recipe), false);
    }

    RecipeView addRecipeVersion(UUID id, RecipeVersionDefinition definition) {
        UUID userId = userId();
        Recipe recipe = recipeRepository.findOwnedByIdForUpdate(id, userId)
                .orElseThrow(() -> new CatalogNotFoundException("Receita não encontrada."));
        Instant now = clock.instant();
        RecipeVersion version = buildRecipeVersion(
                recipe, recipe.nextVersionNumber(), normalize(definition), userId, now);
        recipe.addVersion(version, now);
        recipeRepository.save(recipe);
        return new RecipeView(recipe, recipeFavoriteRepository.existsByUserIdAndRecipeId(userId, id));
    }

    RecipeView duplicateRecipe(UUID id) {
        UUID userId = userId();
        Recipe source = requireRecipe(id, userId);
        RecipeVersion sourceVersion = source.currentVersion();
        List<RecipeIngredientDefinition> ingredients = sourceVersion.ingredients().stream()
                .map(ingredient -> new RecipeIngredientDefinition(
                        ingredient.foodVersion().id(),
                        ingredient.quantity(),
                        ingredient.unit(),
                        ingredient.servingOptionId(),
                        ingredient.referenceQuantityEquivalent()))
                .toList();
        String copiedName = copyName(sourceVersion.name());
        return createRecipe(new RecipeVersionDefinition(
                copiedName,
                sourceVersion.notes(),
                sourceVersion.yieldQuantity(),
                sourceVersion.yieldUnit(),
                sourceVersion.servingQuantity(),
                ingredients));
    }

    void favoriteRecipe(UUID id, boolean favorite) {
        UUID userId = userId();
        requireRecipe(id, userId);
        if (favorite) {
            if (!recipeFavoriteRepository.existsByUserIdAndRecipeId(userId, id)) {
                recipeFavoriteRepository.save(new RecipeFavorite(userId, id, clock.instant()));
            }
        } else {
            recipeFavoriteRepository.deleteByUserIdAndRecipeId(userId, id);
        }
    }

    void archiveRecipe(UUID id, boolean archived) {
        Recipe recipe = recipeRepository.findOwnedByIdForUpdate(id, userId())
                .orElseThrow(() -> new CatalogNotFoundException("Receita não encontrada."));
        recipe.setArchived(archived, clock.instant());
    }

    @Transactional(readOnly = true)
    CatalogNutritionSnapshot resolve(
            CatalogItemType type,
            UUID versionId,
            BigDecimal inputQuantity,
            CatalogUnit inputUnit,
            UUID servingOptionId) {
        if (type == null || versionId == null || inputUnit == null) {
            throw resolution(CatalogNutritionResolutionException.Reason.NOT_FOUND,
                    "A versão do catálogo não foi informada.");
        }
        validateResolutionQuantity(inputQuantity);
        return switch (type) {
            case FOOD -> resolveFood(versionId, inputQuantity, inputUnit, servingOptionId);
            case RECIPE -> resolveRecipe(versionId, inputQuantity, inputUnit, servingOptionId);
        };
    }

    private CatalogNutritionSnapshot resolveFood(
            UUID versionId, BigDecimal inputQuantity, CatalogUnit inputUnit, UUID servingOptionId) {
        FoodVersion version = foodVersionRepository.findVisibleById(versionId, userId())
                .orElseThrow(() -> resolution(
                        CatalogNutritionResolutionException.Reason.NOT_FOUND,
                        "Versão do alimento não encontrada."));
        BigDecimal equivalent = resolveFoodEquivalent(version, inputQuantity, inputUnit, servingOptionId);
        return new CatalogNutritionSnapshot(
                version.id(), CatalogItemType.FOOD, version.name(), CatalogMath.value(inputQuantity), inputUnit,
                servingOptionId, equivalent, version.referenceQuantity(), version.referenceUnit(),
                CatalogMath.scale(version.nutrients(), equivalent, version.referenceQuantity()),
                version.quality(),
                CatalogMath.proportional(version.kcalUncertainty(), equivalent, version.referenceQuantity()));
    }

    private CatalogNutritionSnapshot resolveRecipe(
            UUID versionId, BigDecimal inputQuantity, CatalogUnit inputUnit, UUID servingOptionId) {
        RecipeVersion version = recipeVersionRepository.findVisibleById(versionId, userId())
                .orElseThrow(() -> resolution(
                        CatalogNutritionResolutionException.Reason.NOT_FOUND,
                        "Versão da receita não encontrada."));
        if (servingOptionId != null) {
            throw resolution(CatalogNutritionResolutionException.Reason.INVALID_SERVING,
                    "Receitas não aceitam uma porção de alimento.");
        }

        BigDecimal equivalent;
        if (inputUnit == version.yieldUnit()) {
            equivalent = CatalogMath.value(inputQuantity);
        } else if (inputUnit == CatalogUnit.PORTION && version.servingQuantity() != null) {
            equivalent = CatalogMath.value(inputQuantity.multiply(version.servingQuantity()));
        } else {
            throw resolution(CatalogNutritionResolutionException.Reason.INVALID_UNIT,
                    "A unidade não corresponde ao rendimento ou à porção configurada da receita.");
        }

        RecipeNutrition nutrition = CatalogCalculations.calculate(version);
        return new CatalogNutritionSnapshot(
                version.id(), CatalogItemType.RECIPE, version.name(), CatalogMath.value(inputQuantity), inputUnit,
                null, equivalent, version.yieldQuantity(), version.yieldUnit(),
                CatalogMath.scale(nutrition.total(), equivalent, version.yieldQuantity()),
                nutrition.quality(),
                CatalogMath.proportional(nutrition.kcalUncertainty(), equivalent, version.yieldQuantity()));
    }

    private RecipeVersion buildRecipeVersion(
            Recipe recipe,
            int number,
            RecipeVersionDefinition definition,
            UUID userId,
            Instant now) {
        RecipeVersion version = new RecipeVersion(recipe, number, definition, now);
        for (int position = 0; position < definition.ingredients().size(); position++) {
            int ingredientPosition = position;
            RecipeIngredientDefinition ingredientDefinition = definition.ingredients().get(position);
            FoodVersion foodVersion = foodVersionRepository
                    .findVisibleById(ingredientDefinition.foodVersionId(), userId)
                    .orElseThrow(() -> new CatalogValidationException(
                            "ingredients[" + ingredientPosition + "].foodVersionId",
                            "Versão de alimento indisponível."));
            BigDecimal equivalent = resolveIngredientEquivalent(
                    foodVersion, ingredientDefinition, ingredientPosition);
            version.addIngredient(new RecipeIngredient(
                    version, ingredientPosition, foodVersion, ingredientDefinition, equivalent));
        }
        return version;
    }

    private BigDecimal resolveIngredientEquivalent(
            FoodVersion foodVersion, RecipeIngredientDefinition definition, int position) {
        if (definition.servingOptionId() != null) {
            BigDecimal calculated = resolveFoodEquivalent(
                    foodVersion, definition.quantity(), definition.unit(), definition.servingOptionId());
            if (definition.referenceQuantityEquivalent() != null
                    && calculated.compareTo(CatalogMath.value(definition.referenceQuantityEquivalent())) != 0) {
                throw new CatalogValidationException(
                        "ingredients[" + position + "].referenceQuantityEquivalent",
                        "O equivalente informado não corresponde à porção selecionada.");
            }
            return calculated;
        }

        if (definition.unit() == foodVersion.referenceUnit()) {
            BigDecimal calculated = CatalogMath.value(definition.quantity());
            if (definition.referenceQuantityEquivalent() != null
                    && calculated.compareTo(CatalogMath.value(definition.referenceQuantityEquivalent())) != 0) {
                throw new CatalogValidationException(
                        "ingredients[" + position + "].referenceQuantityEquivalent",
                        "O equivalente deve ser igual à quantidade na unidade de referência.");
            }
            return calculated;
        }

        if (definition.referenceQuantityEquivalent() == null
                || definition.referenceQuantityEquivalent().signum() <= 0) {
            throw new CatalogValidationException(
                    "ingredients[" + position + "].referenceQuantityEquivalent",
                    "Informe o equivalente positivo na unidade de referência.");
        }
        return CatalogMath.value(definition.referenceQuantityEquivalent());
    }

    private BigDecimal resolveFoodEquivalent(
            FoodVersion version, BigDecimal inputQuantity, CatalogUnit inputUnit, UUID servingOptionId) {
        if (servingOptionId == null) {
            if (inputUnit != version.referenceUnit()) {
                throw resolution(CatalogNutritionResolutionException.Reason.INVALID_UNIT,
                        "Selecione uma porção compatível para usar esta unidade.");
            }
            return CatalogMath.value(inputQuantity);
        }
        FoodServingOption serving = version.servings().stream()
                .filter(candidate -> candidate.id().equals(servingOptionId))
                .findFirst()
                .orElseThrow(() -> resolution(
                        CatalogNutritionResolutionException.Reason.INVALID_SERVING,
                        "A porção não pertence à versão selecionada."));
        if (serving.unit() != inputUnit) {
            throw resolution(CatalogNutritionResolutionException.Reason.INVALID_UNIT,
                    "A unidade não corresponde à porção selecionada.");
        }
        return CatalogMath.proportional(
                serving.referenceQuantityEquivalent(), inputQuantity, serving.quantity());
    }

    private FoodItem requireVisibleFood(UUID id, UUID userId) {
        return foodRepository.findVisibleById(id, userId)
                .orElseThrow(() -> new CatalogNotFoundException("Alimento não encontrado."));
    }

    private Recipe requireRecipe(UUID id, UUID userId) {
        return recipeRepository.findByIdAndOwnerUserId(id, userId)
                .orElseThrow(() -> new CatalogNotFoundException("Receita não encontrada."));
    }

    private Set<UUID> foodFavorites(UUID userId, List<UUID> ids) {
        return ids.isEmpty() ? Set.of() : new HashSet<>(foodFavoriteRepository.findFavoriteIds(userId, ids));
    }

    private Set<UUID> recipeFavorites(UUID userId, List<UUID> ids) {
        return ids.isEmpty() ? Set.of() : new HashSet<>(recipeFavoriteRepository.findFavoriteIds(userId, ids));
    }

    private void initializeFood(FoodItem food) {
        food.versions().forEach(version -> version.servings().size());
    }

    private void initializeRecipe(Recipe recipe) {
        recipe.versions().forEach(version -> version.ingredients().forEach(ingredient -> {
            ingredient.foodVersion().name();
            ingredient.foodVersion().nutrients();
        }));
    }

    private String validateSearch(String query) {
        if (query == null) {
            return null;
        }
        String stripped = query.strip();
        if (stripped.isEmpty()) {
            throw new CatalogValidationException("query", "A busca não pode estar vazia.");
        }
        if (stripped.length() > 120) {
            throw new CatalogValidationException("query", "A busca deve ter no máximo 120 caracteres.");
        }
        return stripped;
    }

    private FoodVersionDefinition normalize(FoodVersionDefinition definition) {
        return new FoodVersionDefinition(
                definition.name().strip(),
                stripToNull(definition.brand()),
                stripToNull(definition.notes()),
                definition.referenceQuantity(),
                definition.referenceUnit(),
                definition.caloriesKcal(),
                definition.proteinG(),
                definition.carbohydrateG(),
                definition.fatG(),
                definition.fiberG(),
                definition.sodiumMg(),
                definition.quality(),
                definition.kcalUncertainty(),
                List.copyOf(definition.servings()));
    }

    private RecipeVersionDefinition normalize(RecipeVersionDefinition definition) {
        if (definition.yieldUnit() != CatalogUnit.G
                && definition.yieldUnit() != CatalogUnit.ML
                && definition.yieldUnit() != CatalogUnit.PORTION) {
            throw new CatalogValidationException("yieldUnit", "Use G, ML ou PORTION como rendimento.");
        }
        return new RecipeVersionDefinition(
                definition.name().strip(),
                stripToNull(definition.notes()),
                definition.yieldQuantity(),
                definition.yieldUnit(),
                definition.servingQuantity(),
                List.copyOf(definition.ingredients()));
    }

    private void validateOrigin(FoodOrigin origin, String externalSource, String externalId) {
        if (origin == FoodOrigin.SYSTEM) {
            throw new CatalogValidationException("origin", "Usuários não podem criar alimentos globais.");
        }
        boolean hasSource = stripToNull(externalSource) != null;
        boolean hasId = stripToNull(externalId) != null;
        if (hasSource != hasId) {
            throw new CatalogValidationException(
                    "externalSource", "Fonte e identificador externos devem ser informados juntos.");
        }
        if (origin == FoodOrigin.EXTERNAL && !hasSource) {
            throw new CatalogValidationException(
                    "externalSource", "Alimentos externos exigem fonte e identificador.");
        }
        if (origin == FoodOrigin.USER && hasSource) {
            throw new CatalogValidationException(
                    "origin", "Use a origem EXTERNAL quando houver uma referência externa.");
        }
    }

    private void validateResolutionQuantity(BigDecimal quantity) {
        if (quantity == null || quantity.signum() <= 0) {
            throw resolution(CatalogNutritionResolutionException.Reason.INVALID_QUANTITY,
                    "A quantidade deve ser positiva.");
        }
    }

    private String copyName(String name) {
        String suffix = " (cópia)";
        int maxBase = 160 - suffix.length();
        return (name.length() > maxBase ? name.substring(0, maxBase) : name) + suffix;
    }

    private String stripToNull(String value) {
        if (value == null) return null;
        String stripped = value.strip();
        return stripped.isEmpty() ? null : stripped;
    }

    private UUID userId() {
        return currentUserProvider.requireCurrentUser().id();
    }

    private CatalogNutritionResolutionException resolution(
            CatalogNutritionResolutionException.Reason reason, String message) {
        return new CatalogNutritionResolutionException(reason, message);
    }
}

record FoodView(FoodItem food, boolean favorite) {}
record RecipeView(Recipe recipe, boolean favorite) {}

record CatalogPage<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    static <S, T> CatalogPage<T> from(Page<S> source, java.util.function.Function<S, T> mapper) {
        return new CatalogPage<>(source.getContent().stream().map(mapper).toList(),
                source.getNumber(), source.getSize(), source.getTotalElements(), source.getTotalPages());
    }
}

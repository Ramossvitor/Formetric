package dev.formetric.catalog;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

record ServingDefinition(
        String label,
        CatalogUnit unit,
        BigDecimal quantity,
        BigDecimal referenceQuantityEquivalent) {
}

record FoodVersionDefinition(
        String name,
        String brand,
        String notes,
        BigDecimal referenceQuantity,
        CatalogUnit referenceUnit,
        BigDecimal caloriesKcal,
        BigDecimal proteinG,
        BigDecimal carbohydrateG,
        BigDecimal fatG,
        BigDecimal fiberG,
        BigDecimal sodiumMg,
        NutritionQuality quality,
        BigDecimal kcalUncertainty,
        List<ServingDefinition> servings) {
}

record RecipeIngredientDefinition(
        UUID foodVersionId,
        BigDecimal quantity,
        CatalogUnit unit,
        UUID servingOptionId,
        BigDecimal referenceQuantityEquivalent) {
}

record RecipeVersionDefinition(
        String name,
        String notes,
        BigDecimal yieldQuantity,
        CatalogUnit yieldUnit,
        BigDecimal servingQuantity,
        List<RecipeIngredientDefinition> ingredients) {
}

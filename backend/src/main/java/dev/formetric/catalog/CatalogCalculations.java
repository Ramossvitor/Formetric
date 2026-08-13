package dev.formetric.catalog;

import java.math.BigDecimal;

final class CatalogCalculations {
    private CatalogCalculations() {}

    static RecipeNutrition calculate(RecipeVersion version) {
        NutrientAmounts total = CatalogMath.zero();
        BigDecimal uncertainty = BigDecimal.ZERO.setScale(CatalogMath.SCALE);
        boolean hasUncertainty = false;
        NutritionQuality quality = NutritionQuality.EXACT;

        for (RecipeIngredient ingredient : version.ingredients()) {
            total = CatalogMath.add(total, ingredient.nutrients());
            BigDecimal ingredientUncertainty = ingredient.kcalUncertainty();
            if (ingredientUncertainty != null) {
                uncertainty = CatalogMath.value(uncertainty.add(ingredientUncertainty));
                hasUncertainty = true;
            }
            quality = leastCertain(quality, ingredient.foodVersion().quality());
        }

        NutrientAmounts per100g = version.yieldUnit() == CatalogUnit.G
                ? CatalogMath.scale(total, new BigDecimal("100"), version.yieldQuantity())
                : null;
        NutrientAmounts perServing = version.servingQuantity() == null
                ? null
                : CatalogMath.scale(total, version.servingQuantity(), version.yieldQuantity());

        return new RecipeNutrition(
                total,
                per100g,
                perServing,
                quality,
                hasUncertainty ? uncertainty : null);
    }

    private static NutritionQuality leastCertain(NutritionQuality current, NutritionQuality candidate) {
        return rank(candidate) > rank(current) ? candidate : current;
    }

    private static int rank(NutritionQuality quality) {
        return switch (quality) {
            case EXACT -> 0;
            case ESTIMATED -> 1;
            case HIGHLY_ESTIMATED -> 2;
        };
    }
}

record RecipeNutrition(
        NutrientAmounts total,
        NutrientAmounts per100g,
        NutrientAmounts perServing,
        NutritionQuality quality,
        BigDecimal kcalUncertainty) {
}

package dev.formetric.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class CatalogCalculationsTest {

    private static final Instant NOW = Instant.parse("2026-08-12T12:00:00Z");

    @Test
    void scalesNutrientsProportionallyWithThreeDecimalHalfUpRounding() {
        NutrientAmounts whey = new NutrientAmounts(
                decimal("112"), decimal("27"), decimal("1.5"), decimal("0.8"), decimal("0"), null);

        NutrientAmounts portion = CatalogMath.scale(whey, decimal("42"), decimal("30"));

        assertEquals(decimal("156.800"), portion.caloriesKcal());
        assertEquals(decimal("37.800"), portion.proteinG());
        assertEquals(decimal("2.100"), portion.carbohydrateG());
        assertEquals(decimal("1.120"), portion.fatG());
        assertNull(portion.sodiumMg());
    }

    @Test
    void recipeUsesImmutableFoodAmountsAndDoesNotUnderstateUnknownSodium() {
        FoodItem rice = food("Arroz", "100", "2.5", "28", "0.3", "1.6", "5", NutritionQuality.EXACT);
        FoodItem chicken = food("Frango", "160", "31", "0", "3.6", "0", null, NutritionQuality.ESTIMATED);
        Recipe recipe = new Recipe(java.util.UUID.randomUUID(), NOW);
        RecipeVersion version = new RecipeVersion(recipe, 1, new RecipeVersionDefinition(
                "Arroz com frango", null, decimal("400"), CatalogUnit.G, decimal("200"), List.of()), NOW);
        version.addIngredient(new RecipeIngredient(version, 0, rice.currentVersion(),
                new RecipeIngredientDefinition(rice.currentVersion().id(), decimal("200"), CatalogUnit.G, null, null),
                decimal("200")));
        version.addIngredient(new RecipeIngredient(version, 1, chicken.currentVersion(),
                new RecipeIngredientDefinition(chicken.currentVersion().id(), decimal("200"), CatalogUnit.G, null, null),
                decimal("200")));

        RecipeNutrition result = CatalogCalculations.calculate(version);

        assertEquals(decimal("520.000"), result.total().caloriesKcal());
        assertEquals(decimal("130.000"), result.per100g().caloriesKcal());
        assertEquals(decimal("260.000"), result.perServing().caloriesKcal());
        assertEquals(NutritionQuality.ESTIMATED, result.quality());
        assertNull(result.total().sodiumMg(), "one unknown sodium value makes the deterministic total unknown");
    }

    private FoodItem food(
            String name, String kcal, String protein, String carbs, String fat, String fiber,
            String sodium, NutritionQuality quality) {
        FoodItem food = new FoodItem(java.util.UUID.randomUUID(), FoodOrigin.USER, null, null, NOW);
        food.addVersion(new FoodVersion(food, 1, new FoodVersionDefinition(
                name, null, null, decimal("100"), CatalogUnit.G,
                decimal(kcal), decimal(protein), decimal(carbs), decimal(fat), decimal(fiber),
                sodium == null ? null : decimal(sodium), quality, null, List.of()), NOW), NOW);
        return food;
    }

    private BigDecimal decimal(String value) {
        return new BigDecimal(value);
    }
}

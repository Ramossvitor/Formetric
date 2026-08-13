package dev.formetric.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "recipe_ingredients")
class RecipeIngredient {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipe_version_id", nullable = false, updatable = false)
    private RecipeVersion recipeVersion;
    @Column(nullable = false, updatable = false) private int position;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "food_version_id", nullable = false, updatable = false)
    private FoodVersion foodVersion;
    @Column(precision = 14, scale = 3, nullable = false, updatable = false) private BigDecimal quantity;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false) private CatalogUnit unit;
    @Column(name = "serving_option_id", updatable = false) private UUID servingOptionId;
    @Column(name = "reference_quantity_equivalent", precision = 14, scale = 3, nullable = false, updatable = false)
    private BigDecimal referenceQuantityEquivalent;

    protected RecipeIngredient() {}

    RecipeIngredient(RecipeVersion recipeVersion, int position, FoodVersion foodVersion,
                     RecipeIngredientDefinition definition, BigDecimal equivalent) {
        this.id = UUID.randomUUID();
        this.recipeVersion = recipeVersion;
        this.position = position;
        this.foodVersion = foodVersion;
        this.quantity = CatalogMath.value(definition.quantity());
        this.unit = definition.unit();
        this.servingOptionId = definition.servingOptionId();
        this.referenceQuantityEquivalent = CatalogMath.value(equivalent);
    }

    int position() { return position; }
    FoodVersion foodVersion() { return foodVersion; }
    BigDecimal quantity() { return quantity; }
    CatalogUnit unit() { return unit; }
    UUID servingOptionId() { return servingOptionId; }
    BigDecimal referenceQuantityEquivalent() { return referenceQuantityEquivalent; }
    NutrientAmounts nutrients() {
        return CatalogMath.scale(foodVersion.nutrients(), referenceQuantityEquivalent, foodVersion.referenceQuantity());
    }
    BigDecimal kcalUncertainty() {
        return CatalogMath.proportional(foodVersion.kcalUncertainty(), referenceQuantityEquivalent, foodVersion.referenceQuantity());
    }
}

package dev.formetric.catalog;

import java.io.Serializable;
import java.math.BigDecimal;

/** Immutable nutrient quantities. Sodium remains optional because many sources omit it. */
public record NutrientAmounts(
        BigDecimal caloriesKcal,
        BigDecimal proteinG,
        BigDecimal carbohydrateG,
        BigDecimal fatG,
        BigDecimal fiberG,
        BigDecimal sodiumMg) implements Serializable {
}

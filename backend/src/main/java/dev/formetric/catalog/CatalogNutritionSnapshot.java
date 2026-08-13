package dev.formetric.catalog;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Fully resolved, serializable snapshot consumed by diary entries. Both the input and equivalent
 * basis quantity are retained so history can say "two slices" without recalculating catalog data.
 */
public record CatalogNutritionSnapshot(
        UUID versionId,
        CatalogItemType type,
        String name,
        BigDecimal inputQuantity,
        CatalogUnit inputUnit,
        UUID servingOptionId,
        BigDecimal equivalentBasisQuantity,
        BigDecimal basisQuantity,
        CatalogUnit basisUnit,
        NutrientAmounts nutrients,
        NutritionQuality quality,
        BigDecimal kcalUncertainty) implements Serializable {
}

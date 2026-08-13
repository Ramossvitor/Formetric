package dev.formetric.catalog;

import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Public module boundary used by diary and analytics; persistence entities remain internal. */
@Component
public class CatalogNutritionProvider {

    private final CatalogService catalogService;

    CatalogNutritionProvider(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    public CatalogNutritionSnapshot resolve(
            CatalogItemType type,
            UUID versionId,
            BigDecimal inputQuantity,
            CatalogUnit inputUnit,
            UUID servingOptionId) {
        return catalogService.resolve(type, versionId, inputQuantity, inputUnit, servingOptionId);
    }
}

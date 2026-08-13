package dev.formetric.catalog;

/** Stable exception contract for modules that resolve a catalog version into a diary snapshot. */
public class CatalogNutritionResolutionException extends RuntimeException {

    private final Reason reason;

    public CatalogNutritionResolutionException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }

    public enum Reason {
        NOT_FOUND,
        INVALID_QUANTITY,
        INVALID_UNIT,
        INVALID_SERVING
    }
}

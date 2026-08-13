package dev.formetric.catalog;

class CatalogNotFoundException extends RuntimeException {
    CatalogNotFoundException(String message) { super(message); }
}

class CatalogValidationException extends RuntimeException {
    private final String field;
    CatalogValidationException(String field, String message) {
        super(message);
        this.field = field;
    }
    String field() { return field; }
}

class CatalogConflictException extends RuntimeException {
    CatalogConflictException(String message) { super(message); }
}

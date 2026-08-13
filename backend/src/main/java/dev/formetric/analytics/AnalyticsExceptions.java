package dev.formetric.analytics;

final class AnalyticsValidationException extends RuntimeException {
    private final String field;

    AnalyticsValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    String field() {
        return field;
    }
}

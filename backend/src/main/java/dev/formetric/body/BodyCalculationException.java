package dev.formetric.body;

final class BodyCalculationException extends RuntimeException {

    private final String field;

    BodyCalculationException(String field, String message) {
        super(message);
        this.field = field;
    }

    String field() {
        return field;
    }
}

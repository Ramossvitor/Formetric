package dev.formetric.planning;

final class PlanningValidationException extends RuntimeException {
    private final String field;

    PlanningValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    String field() {
        return field;
    }
}

final class PlanningConflictException extends RuntimeException {
    PlanningConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}

final class PlanningPeriodNotFoundException extends RuntimeException {
    PlanningPeriodNotFoundException(String message) {
        super(message);
    }
}

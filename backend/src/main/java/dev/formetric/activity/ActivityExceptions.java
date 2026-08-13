package dev.formetric.activity;

class ActivityNotFoundException extends RuntimeException {
    ActivityNotFoundException(String message) {
        super(message);
    }
}

class ActivityConflictException extends RuntimeException {
    ActivityConflictException(String message) {
        super(message);
    }

    ActivityConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}

class ActivityValidationException extends RuntimeException {
    private final String field;

    ActivityValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    String field() {
        return field;
    }
}

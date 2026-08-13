package dev.formetric.body;

class BodyNotFoundException extends RuntimeException {
    BodyNotFoundException(String message) {
        super(message);
    }
}

class BodyConflictException extends RuntimeException {
    BodyConflictException(String message) {
        super(message);
    }

    BodyConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}

class BodyValidationException extends RuntimeException {
    private final String field;

    BodyValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    String field() {
        return field;
    }
}

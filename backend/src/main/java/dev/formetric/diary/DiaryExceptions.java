package dev.formetric.diary;

class DiaryNotFoundException extends RuntimeException {
    DiaryNotFoundException(String message) {
        super(message);
    }
}

class DiaryConflictException extends RuntimeException {
    DiaryConflictException(String message) {
        super(message);
    }
}

class DiaryValidationException extends RuntimeException {
    private final String field;

    DiaryValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    String field() {
        return field;
    }
}

package dev.formetric.identity;

class IdentityConflictException extends RuntimeException {
    IdentityConflictException(String message) {
        super(message);
    }
}

class InvalidInviteException extends RuntimeException {
    InvalidInviteException(String message) {
        super(message);
    }
}

class LoginRateLimitedException extends RuntimeException {
    private final long retryAfterSeconds;

    LoginRateLimitedException(long retryAfterSeconds) {
        super("Muitas tentativas de login. Tente novamente mais tarde.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}

class PasswordComputationCapacityException extends RuntimeException {
    private static final long RETRY_AFTER_SECONDS = 1;

    PasswordComputationCapacityException() {
        super("O processamento de senha est\u00e1 temporariamente ocupado. Tente novamente em instantes.");
    }

    long retryAfterSeconds() {
        return RETRY_AFTER_SECONDS;
    }
}

class ResourceNotFoundException extends RuntimeException {
    ResourceNotFoundException(String message) {
        super(message);
    }
}

class UnauthenticatedException extends RuntimeException {
    UnauthenticatedException() {
        super("Autenticação necessária.");
    }
}

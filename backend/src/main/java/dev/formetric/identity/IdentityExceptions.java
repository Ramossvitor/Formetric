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

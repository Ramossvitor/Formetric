package dev.formetric.identity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

final class IdentitySupport {

    private IdentitySupport() {
    }

    static String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    static String hashToken(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 must be supported", exception);
        }
    }
}

@Component
class InviteTokenGenerator {
    private final SecureRandom random = new SecureRandom();

    String generate() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}

@Component
class LoginAttemptLimiter {
    private static final int MAX_FAILURES_BEFORE_LOCK = 5;
    private static final Duration MAX_LOCK = Duration.ofMinutes(15);
    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    void checkAllowed(String key, Instant now) {
        Attempt attempt = attempts.get(key);
        if (attempt == null) {
            return;
        }
        if (attempt.blockedUntil().isAfter(now)) {
            throw new LoginRateLimitedException(Duration.between(now, attempt.blockedUntil()).toSeconds() + 1);
        }
        if (!attempt.blockedUntil().equals(Instant.EPOCH)) {
            attempts.remove(key, attempt);
        }
    }

    void recordFailure(String key, Instant now) {
        attempts.compute(key, (ignored, current) -> {
            int failures = current == null ? 1 : current.failures() + 1;
            if (failures < MAX_FAILURES_BEFORE_LOCK) {
                return new Attempt(failures, Instant.EPOCH);
            }
            long delaySeconds = Math.min(30L * (1L << Math.min(failures - MAX_FAILURES_BEFORE_LOCK, 5)), MAX_LOCK.toSeconds());
            return new Attempt(failures, now.plusSeconds(delaySeconds));
        });
    }

    void recordSuccess(String key) {
        attempts.remove(key);
    }

    private record Attempt(int failures, Instant blockedUntil) {
    }
}

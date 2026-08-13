package dev.formetric.identity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
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
    private static final int ACCOUNT_FAILURE_LIMIT = 5;
    private static final int IP_FAILURE_LIMIT = 20;
    private static final int MAX_TRACKED_KEYS_PER_SCOPE = 10_000;
    private static final Duration ENTRY_TTL = Duration.ofHours(1);
    private static final Duration MAX_LOCK = Duration.ofMinutes(15);
    private final Clock clock;
    private final AttemptStore accountAttempts;
    private final AttemptStore ipAttempts;

    @Autowired
    LoginAttemptLimiter(Clock clock) {
        this(clock, new Limits(
                ACCOUNT_FAILURE_LIMIT,
                IP_FAILURE_LIMIT,
                MAX_TRACKED_KEYS_PER_SCOPE,
                ENTRY_TTL));
    }

    LoginAttemptLimiter(Clock clock, Limits limits) {
        this.clock = clock;
        this.accountAttempts = new AttemptStore(
                limits.accountFailureLimit(), limits.maxTrackedKeysPerScope(), limits.entryTtl());
        this.ipAttempts = new AttemptStore(
                limits.ipFailureLimit(), limits.maxTrackedKeysPerScope(), limits.entryTtl());
    }

    void checkAllowed(String accountIdentifier, String ipAddress) {
        Instant now = clock.instant();
        accountAttempts.checkAllowed(accountIdentifier, now);
        ipAttempts.checkAllowed(ipAddress, now);
    }

    void recordFailure(String accountIdentifier, String ipAddress) {
        Instant now = clock.instant();
        accountAttempts.recordFailure(accountIdentifier, now);
        ipAttempts.recordFailure(ipAddress, now);
    }

    void recordSuccess(String accountIdentifier) {
        accountAttempts.remove(accountIdentifier);
    }

    int trackedAccountCount() {
        return accountAttempts.size(clock.instant());
    }

    int trackedIpCount() {
        return ipAttempts.size(clock.instant());
    }

    record Limits(
            int accountFailureLimit,
            int ipFailureLimit,
            int maxTrackedKeysPerScope,
            Duration entryTtl) {

        Limits {
            if (accountFailureLimit < 1 || ipFailureLimit < 1 || maxTrackedKeysPerScope < 1) {
                throw new IllegalArgumentException("Login limiter thresholds must be positive");
            }
            if (entryTtl == null || entryTtl.isZero() || entryTtl.isNegative()) {
                throw new IllegalArgumentException("Login limiter TTL must be positive");
            }
        }
    }

    private static final class AttemptStore {
        private final int failureLimit;
        private final int maxTrackedKeys;
        private final Duration entryTtl;
        private final Map<String, Attempt> attempts = new LinkedHashMap<>(16, 0.75f, true);

        private AttemptStore(int failureLimit, int maxTrackedKeys, Duration entryTtl) {
            this.failureLimit = failureLimit;
            this.maxTrackedKeys = maxTrackedKeys;
            this.entryTtl = entryTtl;
        }

        private synchronized void checkAllowed(String key, Instant now) {
            evictExpired(now);
            Attempt attempt = attempts.get(key);
            if (attempt != null && attempt.blockedUntil().isAfter(now)) {
                long seconds = Math.max(1, Duration.between(now, attempt.blockedUntil()).toSeconds() + 1);
                throw new LoginRateLimitedException(seconds);
            }
        }

        private synchronized void recordFailure(String key, Instant now) {
            evictExpired(now);
            Attempt current = attempts.get(key);
            if (current == null && attempts.size() >= maxTrackedKeys) {
                Iterator<String> iterator = attempts.keySet().iterator();
                if (iterator.hasNext()) {
                    iterator.next();
                    iterator.remove();
                }
            }
            int failures = current == null ? 1 : current.failures() + 1;
            Instant blockedUntil = Instant.EPOCH;
            if (failures >= failureLimit) {
                int exponent = Math.min(failures - failureLimit, 5);
                long delaySeconds = Math.min(30L * (1L << exponent), MAX_LOCK.toSeconds());
                blockedUntil = now.plusSeconds(delaySeconds);
            }
            attempts.put(key, new Attempt(failures, blockedUntil, now.plus(entryTtl)));
        }

        private synchronized void remove(String key) {
            attempts.remove(key);
        }

        private synchronized int size(Instant now) {
            evictExpired(now);
            return attempts.size();
        }

        private void evictExpired(Instant now) {
            attempts.values().removeIf(attempt -> !attempt.expiresAt().isAfter(now));
        }
    }

    private record Attempt(int failures, Instant blockedUntil, Instant expiresAt) {
    }
}

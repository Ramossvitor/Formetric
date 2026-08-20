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
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
class PasswordComputationGate {
    private final Semaphore permits;
    private final Duration acquireTimeout;

    @Autowired
    PasswordComputationGate(
            @Value("${formetric.security.password-computation.max-concurrent:2}") int maxConcurrent,
            @Value("${formetric.security.password-computation.acquire-timeout-ms:25}") long acquireTimeoutMillis) {
        this(maxConcurrent, Duration.ofMillis(acquireTimeoutMillis));
    }

    PasswordComputationGate(int maxConcurrent, Duration acquireTimeout) {
        if (maxConcurrent < 1) {
            throw new IllegalArgumentException("Password computation concurrency must be positive");
        }
        if (acquireTimeout == null || acquireTimeout.isNegative() || acquireTimeout.compareTo(Duration.ofSeconds(1)) > 0) {
            throw new IllegalArgumentException("Password computation acquisition timeout must be between 0 and 1 second");
        }
        this.permits = new Semaphore(maxConcurrent, true);
        this.acquireTimeout = acquireTimeout;
    }

    <T> T compute(Supplier<T> computation) {
        boolean acquired;
        try {
            acquired = permits.tryAcquire(acquireTimeout.toNanos(), TimeUnit.NANOSECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new PasswordComputationCapacityException();
        }
        if (!acquired) {
            throw new PasswordComputationCapacityException();
        }
        try {
            return computation.get();
        } finally {
            permits.release();
        }
    }

    int availablePermits() {
        return permits.availablePermits();
    }
}

@Component
class LoginAttemptLimiter {
    private static final int ACCOUNT_FAILURE_LIMIT = 5;
    private static final int ORIGIN_FAILURE_LIMIT = 20;
    private static final int GLOBAL_FAILURE_LIMIT = 100;
    private static final int MAX_TRACKED_KEYS_PER_SCOPE = 10_000;
    private static final Duration ENTRY_TTL = Duration.ofHours(1);
    private static final Duration MAX_LOCK = Duration.ofMinutes(15);
    private static final int EXPIRATION_CLEANUP_BUDGET = 16;
    private static final String GLOBAL_SCOPE = "all-login-attempts";
    private final Clock clock;
    private final AttemptStore accountAttempts;
    private final AttemptStore originAttempts;
    private final AttemptStore globalAttempts;

    @Autowired
    LoginAttemptLimiter(Clock clock) {
        this(clock, new Limits(
                ACCOUNT_FAILURE_LIMIT,
                ORIGIN_FAILURE_LIMIT,
                GLOBAL_FAILURE_LIMIT,
                MAX_TRACKED_KEYS_PER_SCOPE,
                ENTRY_TTL));
    }

    LoginAttemptLimiter(Clock clock, Limits limits) {
        this.clock = clock;
        this.accountAttempts = new AttemptStore(
                limits.accountFailureLimit(), limits.maxTrackedKeysPerScope(), limits.entryTtl());
        this.originAttempts = new AttemptStore(
                limits.originFailureLimit(), limits.maxTrackedKeysPerScope(), limits.entryTtl());
        this.globalAttempts = new AttemptStore(limits.globalFailureLimit(), 1, limits.entryTtl());
    }

    void checkAllowed(String accountIdentifier, String requestOrigin) {
        Instant now = clock.instant();
        globalAttempts.checkAllowed(GLOBAL_SCOPE, now);
        accountAttempts.checkAllowed(accountIdentifier, now);
        originAttempts.checkAllowed(requestOrigin, now);
    }

    void recordFailure(String accountIdentifier, String requestOrigin) {
        Instant now = clock.instant();
        globalAttempts.recordFailure(GLOBAL_SCOPE, now);
        accountAttempts.recordFailure(accountIdentifier, now);
        originAttempts.recordFailure(requestOrigin, now);
    }

    void recordSuccess(String accountIdentifier) {
        accountAttempts.remove(accountIdentifier);
    }

    int trackedAccountCount() {
        return accountAttempts.size(clock.instant());
    }

    int trackedOriginCount() {
        return originAttempts.size(clock.instant());
    }

    int trackedGlobalCount() {
        return globalAttempts.size(clock.instant());
    }

    record Limits(
            int accountFailureLimit,
            int originFailureLimit,
            int globalFailureLimit,
            int maxTrackedKeysPerScope,
            Duration entryTtl) {

        Limits {
            if (accountFailureLimit < 1
                    || originFailureLimit < 1
                    || globalFailureLimit < 1
                    || maxTrackedKeysPerScope < 1) {
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
        private final NavigableMap<Instant, Set<String>> expirations = new TreeMap<>();

        private AttemptStore(int failureLimit, int maxTrackedKeys, Duration entryTtl) {
            this.failureLimit = failureLimit;
            this.maxTrackedKeys = maxTrackedKeys;
            this.entryTtl = entryTtl;
        }

        private synchronized void checkAllowed(String key, Instant now) {
            evictExpired(now, EXPIRATION_CLEANUP_BUDGET);
            Attempt attempt = attempts.get(key);
            if (attempt != null && !attempt.expiresAt().isAfter(now)) {
                remove(key, attempt);
                return;
            }
            if (attempt != null && attempt.blockedUntil().isAfter(now)) {
                long seconds = Math.max(1, Duration.between(now, attempt.blockedUntil()).toSeconds() + 1);
                throw new LoginRateLimitedException(seconds);
            }
        }

        private synchronized void recordFailure(String key, Instant now) {
            evictExpired(now, EXPIRATION_CLEANUP_BUDGET);
            Attempt current = attempts.get(key);
            if (current != null && !current.expiresAt().isAfter(now)) {
                remove(key, current);
                current = null;
            }
            if (current == null && attempts.size() >= maxTrackedKeys) {
                Iterator<Map.Entry<String, Attempt>> iterator = attempts.entrySet().iterator();
                if (iterator.hasNext()) {
                    Map.Entry<String, Attempt> leastRecentlyUsed = iterator.next();
                    String leastRecentlyUsedKey = leastRecentlyUsed.getKey();
                    Instant leastRecentlyUsedExpiry = leastRecentlyUsed.getValue().expiresAt();
                    iterator.remove();
                    removeExpiration(leastRecentlyUsedKey, leastRecentlyUsedExpiry);
                }
            }
            int failures = current == null ? 1 : current.failures() + 1;
            Instant blockedUntil = Instant.EPOCH;
            if (failures >= failureLimit) {
                int exponent = Math.min(failures - failureLimit, 5);
                long delaySeconds = Math.min(30L * (1L << exponent), MAX_LOCK.toSeconds());
                blockedUntil = now.plusSeconds(delaySeconds);
            }
            Instant expiresAt = now.plus(entryTtl);
            if (current != null) {
                removeExpiration(key, current.expiresAt());
            }
            attempts.put(key, new Attempt(failures, blockedUntil, expiresAt));
            expirations.computeIfAbsent(expiresAt, ignored -> new LinkedHashSet<>()).add(key);
        }

        private synchronized void remove(String key) {
            Attempt removed = attempts.remove(key);
            if (removed != null) {
                removeExpiration(key, removed.expiresAt());
            }
        }

        private synchronized int size(Instant now) {
            evictExpired(now, Integer.MAX_VALUE);
            return attempts.size();
        }

        private void evictExpired(Instant now, int budget) {
            int removed = 0;
            while (removed < budget) {
                Map.Entry<Instant, Set<String>> nextExpiration = expirations.firstEntry();
                if (nextExpiration == null || nextExpiration.getKey().isAfter(now)) {
                    return;
                }
                Iterator<String> keys = nextExpiration.getValue().iterator();
                while (keys.hasNext() && removed < budget) {
                    attempts.remove(keys.next());
                    keys.remove();
                    removed++;
                }
                if (nextExpiration.getValue().isEmpty()) {
                    expirations.pollFirstEntry();
                }
            }
        }

        private void remove(String key, Attempt attempt) {
            attempts.remove(key);
            removeExpiration(key, attempt.expiresAt());
        }

        private void removeExpiration(String key, Instant expiresAt) {
            Set<String> keys = expirations.get(expiresAt);
            if (keys == null) {
                return;
            }
            keys.remove(key);
            if (keys.isEmpty()) {
                expirations.remove(expiresAt);
            }
        }
    }

    private record Attempt(int failures, Instant blockedUntil, Instant expiresAt) {
    }
}

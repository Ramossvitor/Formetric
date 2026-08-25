package dev.formetric.identity;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Resolves profile-zone calendar boundaries from the application's canonical UTC clock. */
@Component
public class CurrentUserTemporalContextProvider {

    private final CurrentUserProvider currentUserProvider;
    private final UserProfileRepository profiles;
    private final Clock clock;

    CurrentUserTemporalContextProvider(
            CurrentUserProvider currentUserProvider,
            UserProfileRepository profiles,
            Clock clock) {
        this.currentUserProvider = currentUserProvider;
        this.profiles = profiles;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CurrentUserTemporalContext requireCurrentUserTemporalContext() {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        UserProfile profile = profiles.findById(userId)
                .orElseThrow(() -> new IllegalStateException("Authenticated account has no profile"));
        Instant serverNow = clock.instant();
        ZoneId timeZone = ZoneId.of(profile.timeZone());
        LocalDate today = serverNow.atZone(timeZone).toLocalDate();
        Instant nextDayAt = today.plusDays(1).atStartOfDay(timeZone).toInstant();
        return new CurrentUserTemporalContext(
                serverNow,
                today,
                timeZone,
                profile.locale(),
                nextDayAt);
    }
}

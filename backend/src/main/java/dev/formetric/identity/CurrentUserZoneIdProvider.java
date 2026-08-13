package dev.formetric.identity;

import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Exposes only the authenticated user's validated time zone to other modules. */
@Component
public class CurrentUserZoneIdProvider {

    private final CurrentUserProvider currentUserProvider;
    private final UserProfileRepository profiles;

    CurrentUserZoneIdProvider(CurrentUserProvider currentUserProvider, UserProfileRepository profiles) {
        this.currentUserProvider = currentUserProvider;
        this.profiles = profiles;
    }

    @Transactional(readOnly = true)
    public ZoneId requireCurrentUserZoneId() {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        UserProfile profile = profiles.findById(userId)
                .orElseThrow(() -> new IllegalStateException("Authenticated account has no profile"));
        return ZoneId.of(profile.timeZone());
    }
}

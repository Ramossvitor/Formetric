package dev.formetric.identity;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/** Canonical temporal context derived from one instant and the authenticated user's profile. */
public record CurrentUserTemporalContext(
        Instant serverNow,
        LocalDate today,
        ZoneId timeZone,
        String locale,
        Instant nextDayAt) {
}

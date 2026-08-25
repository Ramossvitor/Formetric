package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CurrentUserTemporalContextProviderTests {

    private static final UUID USER_ID = UUID.fromString("71000000-0000-0000-0000-000000000001");

    @Test
    void derivesSaoPauloAndUtcDatesFromTheSameBoundaryInstant() {
        Instant boundary = Instant.parse("2026-08-13T01:00:00Z");

        CurrentUserTemporalContext saoPaulo = contextAt(boundary, "America/Sao_Paulo");
        CurrentUserTemporalContext utc = contextAt(boundary, "UTC");

        assertThat(saoPaulo.serverNow()).isEqualTo(boundary);
        assertThat(saoPaulo.today()).hasToString("2026-08-12");
        assertThat(saoPaulo.nextDayAt()).isEqualTo(Instant.parse("2026-08-13T03:00:00Z"));
        assertThat(saoPaulo.locale()).isEqualTo("pt-BR");
        assertThat(utc.serverNow()).isEqualTo(boundary);
        assertThat(utc.today()).hasToString("2026-08-13");
        assertThat(utc.nextDayAt()).isEqualTo(Instant.parse("2026-08-14T00:00:00Z"));
    }

    @Test
    void nextDayBoundaryReflectsTwentyThreeTwentyFourAndTwentyFiveHourCivilDays() {
        CurrentUserTemporalContext springForward =
                contextAt(Instant.parse("2026-03-08T12:00:00Z"), "America/New_York");
        CurrentUserTemporalContext ordinary =
                contextAt(Instant.parse("2026-03-10T12:00:00Z"), "America/New_York");
        CurrentUserTemporalContext fallBack =
                contextAt(Instant.parse("2026-11-01T12:00:00Z"), "America/New_York");

        assertThat(civilDayLength(springForward)).isEqualTo(Duration.ofHours(23));
        assertThat(civilDayLength(ordinary)).isEqualTo(Duration.ofHours(24));
        assertThat(civilDayLength(fallBack)).isEqualTo(Duration.ofHours(25));
    }

    private static Duration civilDayLength(CurrentUserTemporalContext context) {
        Instant dayStart = context.today().atStartOfDay(context.timeZone()).toInstant();
        return Duration.between(dayStart, context.nextDayAt());
    }

    private static CurrentUserTemporalContext contextAt(Instant instant, String timeZoneId) {
        CurrentUserProvider currentUserProvider = mock(CurrentUserProvider.class);
        UserProfileRepository profiles = mock(UserProfileRepository.class);
        when(currentUserProvider.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(USER_ID, "time@example.test", "Time User", UserRole.USER));
        UserProfile profile = UserProfile.defaults(USER_ID, "Time User", instant);
        profile.update(
                "Time User", "pt-BR", timeZoneId, UnitSystem.METRIC, null, null, instant);
        when(profiles.findById(USER_ID)).thenReturn(Optional.of(profile));
        var provider = new CurrentUserTemporalContextProvider(
                currentUserProvider,
                profiles,
                Clock.fixed(instant, ZoneOffset.UTC));
        return provider.requireCurrentUserTemporalContext();
    }
}

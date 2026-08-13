package dev.formetric.activity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import dev.formetric.identity.AuthenticatedUser;
import dev.formetric.identity.CurrentUserProvider;
import dev.formetric.identity.UserRole;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import static org.mockito.Mockito.when;

@SpringBootTest
@Testcontainers
@Import(ActivityIntegrationTests.FixedClockConfiguration.class)
class ActivityIntegrationTests {

    private static final UUID USER_ONE = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID USER_TWO = UUID.fromString("20000000-0000-0000-0000-000000000002");

    @Container
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private ActivityService activityService;

    @Autowired
    private ActivityDataProvider activityDataProvider;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private CurrentUserProvider currentUserProvider;

    @BeforeEach
    void prepareUsers() {
        jdbcTemplate.update("DELETE FROM user_accounts");
        createUser(USER_ONE, "one@example.test");
        createUser(USER_TWO, "two@example.test");
        authenticate(USER_ONE);
    }

    @Test
    void workoutCrudIsIdempotentAndStrictlyIsolatedByUser() {
        UUID requestId = UUID.randomUUID();
        CreateWorkoutRequest request = new CreateWorkoutRequest(
                requestId,
                LocalDate.parse("2026-08-13"),
                WorkoutModality.STRENGTH,
                null,
                "Peito + bíceps",
                List.of("Peito", "Bíceps"),
                LocalTime.of(18, 30),
                70,
                new BigDecimal("450"),
                "Boa progressão");

        WorkoutResponse created = activityService.createWorkout(request);
        WorkoutResponse replayed = activityService.createWorkout(request);

        assertEquals(created.id(), replayed.id());
        assertEquals(1, activityService.listWorkouts(
                LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-31")).size());
        assertThrows(ActivityConflictException.class, () -> activityService.createWorkout(
                new CreateWorkoutRequest(
                        requestId, request.date(), request.modality(), request.customModality(), "Outro título",
                        request.muscleGroups(), request.startTime(), request.durationMinutes(),
                        request.estimatedKcal(), request.notes())));

        WorkoutResponse updated = activityService.updateWorkout(created.id(), new UpdateWorkoutRequest(
                created.date(),
                created.modality(),
                created.customModality(),
                "Peito + tríceps",
                List.of("Peito", "Tríceps"),
                created.startTime(),
                75,
                new BigDecimal("475"),
                created.notes(),
                created.version()));
        assertEquals("Peito + tríceps", updated.title());
        assertEquals(1, updated.version());
        assertThrows(ActivityConflictException.class, () -> activityService.updateWorkout(
                created.id(), new UpdateWorkoutRequest(
                        updated.date(), updated.modality(), null, updated.title(), updated.muscleGroups(),
                        updated.startTime(), updated.durationMinutes(), updated.estimatedKcal(), updated.notes(), 0L)));

        authenticate(USER_TWO);
        assertThrows(ActivityNotFoundException.class, () -> activityService.getWorkout(created.id()));
        assertEquals(0, activityService.listWorkouts(
                LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-31")).size());
        assertThrows(ActivityNotFoundException.class, () -> activityService.deleteWorkout(created.id()));

        authenticate(USER_ONE);
        activityService.deleteWorkout(created.id());
        assertThrows(ActivityNotFoundException.class, () -> activityService.getWorkout(created.id()));
    }

    @Test
    void weightUpsertPreservesOneOfficialObservationAndCalculatesWindowedMetrics() {
        putWeight("2026-01-01", "100", null);
        putWeight("2026-01-14", "95", null);
        putWeight("2026-01-20", "90", null);
        putWeight("2026-01-24", "88", null);
        WeightLogResponse latest = putWeight("2026-01-28", "86", null);

        assertThrows(ActivityConflictException.class, () -> putWeight("2026-01-28", "85.8", null));
        WeightLogResponse corrected = putWeight("2026-01-28", "85.8", latest.version());
        assertEquals(1, corrected.version());

        WeightOverviewResponse overview = activityService.weightOverview(
                LocalDate.parse("2026-01-01"), LocalDate.parse("2026-01-31"));
        assertEquals(new BigDecimal("85.800"), overview.currentWeightKg());
        assertEquals(new BigDecimal("-14.200"), overview.changeKg());
        assertEquals(2, overview.movingAverage7().sampleCount());
        assertEquals(new BigDecimal("86.900"), overview.movingAverage7().valueKg());
        assertEquals(3, overview.movingAverage14().sampleCount());
        assertEquals(5, overview.trend().sampleCount());
        assertNotNull(overview.trend().kgPerWeek());

        authenticate(USER_TWO);
        assertThrows(
                ActivityNotFoundException.class,
                () -> activityService.getWeightLog(LocalDate.parse("2026-01-28")));
        WeightLogResponse otherUser = putWeight("2026-01-28", "72", null);
        assertEquals(new BigDecimal("72.000"), otherUser.weightKg());

        authenticate(USER_ONE);
        assertEquals(5, activityService.listWeightLogs(
                LocalDate.parse("2026-01-01"), LocalDate.parse("2026-01-31")).size());
    }

    @Test
    void databaseEnforcesOfficialWeightUniquenessAndWorkoutShape() {
        putWeight("2026-08-13", "89.8", null);

        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO weight_logs
                    (id, user_id, measurement_date, weight_kg, measured_at, created_at, updated_at, version)
                VALUES (?, ?, DATE '2026-08-13', 90, TIME '08:00', now(), now(), 0)
                """, UUID.randomUUID(), USER_ONE));
        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO workouts
                    (id, user_id, activity_date, modality, custom_modality, title,
                     duration_minutes, created_at, updated_at, version)
                VALUES (?, ?, DATE '2026-08-13', 'OTHER', NULL, 'Esporte', 60, now(), now(), 0)
                """, UUID.randomUUID(), USER_ONE));
    }

    @Test
    void analyticsProviderPreservesTheEffectiveNameOfCustomModalities() {
        activityService.createWorkout(new CreateWorkoutRequest(
                null,
                LocalDate.parse("2026-08-13"),
                WorkoutModality.OTHER,
                "Escalada indoor",
                "Sessão técnica",
                List.of("Antebraços"),
                LocalTime.of(19, 0),
                90,
                null,
                null));

        ActivityDataProvider.WorkoutData workout = activityDataProvider.workouts(
                LocalDate.parse("2026-08-13"), LocalDate.parse("2026-08-13")).getFirst();

        assertEquals(WorkoutModality.OTHER, workout.modality());
        assertEquals("Escalada indoor", workout.customModality());
    }

    private WeightLogResponse putWeight(String date, String kg, Long version) {
        return activityService.upsertWeightLog(
                LocalDate.parse(date),
                new UpsertWeightLogRequest(
                        new BigDecimal(kg), LocalTime.of(8, 10), "Em jejum", null, version));
    }

    private void authenticate(UUID userId) {
        when(currentUserProvider.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(userId, userId + "@example.test", "Test User", UserRole.USER));
    }

    private void createUser(UUID userId, String email) {
        jdbcTemplate.update("""
                INSERT INTO user_accounts
                    (id, email, password_hash, role, status, created_at, updated_at)
                VALUES (?, ?, 'test-only', 'USER', 'ACTIVE', now(), now())
                """, userId, email);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedClockConfiguration {
        @Bean
        @Primary
        Clock fixedActivityTestClock() {
            return Clock.fixed(Instant.parse("2026-08-13T12:00:00Z"), ZoneOffset.UTC);
        }
    }
}

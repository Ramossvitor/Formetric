package dev.formetric.planning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.formetric.identity.AuthenticatedUser;
import dev.formetric.identity.CurrentUserProvider;
import dev.formetric.identity.CurrentUserTemporalContext;
import dev.formetric.identity.CurrentUserTemporalContextProvider;
import dev.formetric.identity.UserRole;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
@Import(PlanningIntegrationTests.FixedClockConfiguration.class)
class PlanningIntegrationTests {

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
    private PlanningService planningService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CurrentUserProvider currentUserProvider;

    @MockitoBean
    private CurrentUserTemporalContextProvider temporalContextProvider;

    @BeforeEach
    void prepareUsers() {
        jdbcTemplate.update("DELETE FROM user_accounts");
        createUser(USER_ONE, "one@example.test");
        createUser(USER_TWO, "two@example.test");
        authenticate(USER_ONE);
        when(temporalContextProvider.requireCurrentUserTemporalContext()).thenReturn(
                temporalContext(Instant.parse("2026-08-12T12:00:00Z"), ZoneId.of("America/Sao_Paulo")));
    }

    @Test
    void appendingCurrentOrFutureGoalClosesOpenPeriodAndEffectiveLookupUsesHalfOpenDates() {
        var first = planningService.createNutritionGoalPeriod(nutritionRequest(
                LocalDate.of(2026, 8, 12), null, "2500"));
        var second = planningService.createNutritionGoalPeriod(nutritionRequest(
                LocalDate.of(2026, 9, 1), null, "2600"));

        var history = planningService.listNutritionGoalPeriods();
        assertEquals(2, history.size());
        assertEquals(LocalDate.of(2026, 9, 1), history.getFirst().validTo());
        assertNull(history.getLast().validTo());
        assertEquals(first.id(), planningService.effectiveNutritionGoalPeriod(LocalDate.of(2026, 8, 31)).id());
        assertEquals(second.id(), planningService.effectiveNutritionGoalPeriod(LocalDate.of(2026, 9, 1)).id());
        var bands = history.getLast().targets().getFirst().bands();
        assertFalse(bands.getFirst().countsAsAttained());
        assertTrue(bands.getLast().countsAsAttained());
    }

    @Test
    void profileLocalTodayClosesTheOpenPeriodWhenUtcIsAlreadyOnTheNextDate() {
        Instant eveningInSaoPaulo = Instant.parse("2026-08-13T01:00:00Z");
        when(temporalContextProvider.requireCurrentUserTemporalContext()).thenReturn(
                temporalContext(eveningInSaoPaulo, ZoneId.of("America/Sao_Paulo")));
        planningService.createTdeePeriod(tdeeRequest("2026-08-01", null, "2900"));

        var current = planningService.createTdeePeriod(tdeeRequest("2026-08-12", null, "3000"));

        var history = planningService.listTdeePeriods();
        assertEquals(LocalDate.of(2026, 8, 12), history.getFirst().validTo());
        assertNull(history.getLast().validTo());
        assertEquals(eveningInSaoPaulo, current.createdAt());
    }

    @Test
    void calorieBandsAreVersionedWhileLegacyPeriodsRemainUnclassified() {
        var legacy = planningService.createNutritionGoalPeriod(nutritionRequest(
                LocalDate.of(2026, 8, 12), null, "2500"));
        var classified = planningService.createNutritionGoalPeriod(nutritionRequestWithCalories(
                LocalDate.of(2026, 9, 1), null, "2500", "2400", "2600"));

        assertTrue(legacy.targets().stream().noneMatch(target -> target.nutrient() == NutrientType.CALORIES));
        var calorieTarget = classified.targets().stream()
                .filter(target -> target.nutrient() == NutrientType.CALORIES)
                .findFirst()
                .orElseThrow();
        assertEquals(NutritionUnit.KCAL, calorieTarget.unit());
        assertEquals("Planejado", calorieTarget.bands().get(1).label());
        assertEquals(legacy.id(), planningService.effectiveNutritionGoalPeriod(LocalDate.of(2026, 8, 31)).id());
        assertEquals(classified.id(), planningService.effectiveNutritionGoalPeriod(LocalDate.of(2026, 9, 1)).id());
    }

    @Test
    void databaseRejectsNonCanonicalMetricUnitPairs() {
        UUID periodId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO nutrition_goal_periods
                    (id, user_id, valid_from, valid_to, calorie_target, created_at, updated_at)
                VALUES (?, ?, DATE '2026-01-01', DATE '2026-02-01', 2500, now(), now())
                """, periodId, USER_ONE);

        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO nutrient_targets (id, goal_period_id, nutrient, unit)
                VALUES (?, ?, 'CALORIES', 'G')
                """, UUID.randomUUID(), periodId));
        jdbcTemplate.update("""
                INSERT INTO nutrient_targets (id, goal_period_id, nutrient, unit)
                VALUES (?, ?, 'CALORIES', 'KCAL')
                """, UUID.randomUUID(), periodId);

        Long count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM nutrient_targets WHERE goal_period_id = ?",
                Long.class,
                periodId);
        assertEquals(1L, count);
    }

    @Test
    @WithMockUser(username = "planning-user")
    void requestRejectsValuesThatWouldBeRoundedByNumericColumns() throws Exception {
        mockMvc.perform(post("/api/v1/nutrition-goal-periods")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "validFrom": "2026-10-01",
                                  "calorieTarget": 2500.0001,
                                  "targets": []
                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("calorieTarget"));

        mockMvc.perform(post("/api/v1/nutrition-goal-periods")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "validFrom": "2026-10-01",
                                  "calorieTarget": 2500,
                                  "targets": [{
                                    "nutrient": "CALORIES",
                                    "unit": "KCAL",
                                    "bands": [{
                                      "position": 0,
                                      "minValue": 2400.0001,
                                      "maxValue": 2600,
                                      "minInclusive": true,
                                      "maxInclusive": true,
                                      "label": "Planejado",
                                      "tone": "POSITIVE",
                                      "countsAsAttained": true
                                    }]
                                  }]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("targets[0].bands[0].minValue"));

        mockMvc.perform(post("/api/v1/tdee-periods")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "validFrom": "2026-10-01",
                                  "kcalPerDay": 3000.0001
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("kcalPerDay"));
    }

    @Test
    void databaseConstraintRejectsOverlapButAllowsSameDatesForDifferentUsers() {
        planningService.createTdeePeriod(tdeeRequest("2026-01-01", "2026-03-01", "2900"));

        assertThrows(
                PlanningConflictException.class,
                () -> planningService.createTdeePeriod(tdeeRequest("2026-02-01", "2026-04-01", "3000")));

        authenticate(USER_TWO);
        var otherUsersPeriod = planningService.createTdeePeriod(
                tdeeRequest("2026-01-01", "2026-03-01", "3100"));

        assertEquals(1, planningService.listTdeePeriods().size());
        assertEquals(otherUsersPeriod.id(), planningService.effectiveTdeePeriod(LocalDate.of(2026, 2, 1)).id());

        authenticate(USER_ONE);
        assertEquals(1, planningService.listTdeePeriods().size());
        assertEquals(new BigDecimal("2900.000"),
                planningService.effectiveTdeePeriod(LocalDate.of(2026, 2, 1)).kcalPerDay());
    }

    @Test
    void historicalAppendDoesNotRewriteAnAlreadyClosedPeriod() {
        planningService.createTdeePeriod(tdeeRequest("2026-01-01", "2026-02-01", "2800"));

        planningService.createTdeePeriod(tdeeRequest("2025-01-01", "2025-02-01", "2700"));

        var history = planningService.listTdeePeriods();
        assertEquals(2, history.size());
        assertEquals(LocalDate.of(2025, 2, 1), history.getFirst().validTo());
        assertEquals(LocalDate.of(2026, 2, 1), history.getLast().validTo());
    }

    private CreateNutritionGoalPeriodRequest nutritionRequest(
            LocalDate from, LocalDate to, String calories) {
        return new CreateNutritionGoalPeriodRequest(
                from,
                to,
                new BigDecimal(calories),
                List.of(new NutrientTargetRequest(
                        NutrientType.PROTEIN,
                        NutritionUnit.G,
                        List.of(
                                new GoalBandRequest(
                                        0, null, new BigDecimal("175"), false, false,
                                        "Abaixo", GoalTone.WARNING, false),
                                new GoalBandRequest(
                                        1, new BigDecimal("175"), null, true, false,
                                        "Meta", GoalTone.POSITIVE, true)))));
    }

    private CreateNutritionGoalPeriodRequest nutritionRequestWithCalories(
            LocalDate from,
            LocalDate to,
            String calories,
            String minimum,
            String maximum) {
        return new CreateNutritionGoalPeriodRequest(
                from,
                to,
                new BigDecimal(calories),
                List.of(
                        new NutrientTargetRequest(
                                NutrientType.CALORIES,
                                NutritionUnit.KCAL,
                                List.of(
                                        new GoalBandRequest(
                                                0, null, new BigDecimal(minimum), false, false,
                                                "Abaixo", GoalTone.WARNING, false),
                                        new GoalBandRequest(
                                                1, new BigDecimal(minimum), new BigDecimal(maximum), true, true,
                                                "Planejado", GoalTone.POSITIVE, true),
                                        new GoalBandRequest(
                                                2, new BigDecimal(maximum), null, false, false,
                                                "Acima", GoalTone.WARNING, false))),
                        new NutrientTargetRequest(
                                NutrientType.PROTEIN,
                                NutritionUnit.G,
                                List.of(
                                        new GoalBandRequest(
                                                0, null, new BigDecimal("175"), false, false,
                                                "Abaixo", GoalTone.WARNING, false),
                                        new GoalBandRequest(
                                                1, new BigDecimal("175"), null, true, false,
                                                "Meta", GoalTone.POSITIVE, true)))));
    }

    private CreateTdeePeriodRequest tdeeRequest(String from, String to, String kcal) {
        return new CreateTdeePeriodRequest(
                LocalDate.parse(from),
                to == null ? null : LocalDate.parse(to),
                new BigDecimal(kcal));
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

    private static CurrentUserTemporalContext temporalContext(Instant now, ZoneId timeZone) {
        LocalDate today = now.atZone(timeZone).toLocalDate();
        return new CurrentUserTemporalContext(
                now,
                today,
                timeZone,
                "pt-BR",
                today.plusDays(1).atStartOfDay(timeZone).toInstant());
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedClockConfiguration {
        @Bean
        @Primary
        Clock fixedPlanningTestClock() {
            return Clock.fixed(Instant.parse("2026-08-12T12:00:00Z"), ZoneOffset.UTC);
        }
    }
}

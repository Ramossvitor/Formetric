package dev.formetric.analytics;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.formetric.TestcontainersConfiguration;
import dev.formetric.identity.AuthenticatedUser;
import dev.formetric.identity.CurrentUserProvider;
import dev.formetric.identity.UserRole;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, AnalyticsIntegrationTests.FixedClockConfiguration.class})
class AnalyticsIntegrationTests {

    private static final UUID USER_ONE = UUID.fromString("81000000-0000-0000-0000-000000000001");
    private static final UUID USER_TWO = UUID.fromString("82000000-0000-0000-0000-000000000002");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private CurrentUserProvider currentUserProvider;

    @BeforeEach
    void seedScenario() {
        jdbcTemplate.update("DELETE FROM user_accounts");
        createUser(USER_ONE, "analytics-one@example.test", "America/Sao_Paulo");
        createUser(USER_TWO, "analytics-two@example.test", "UTC");
        authenticate(USER_ONE);

        insertTdee(USER_ONE, "2026-08-01", "2026-08-03", "2500");
        insertTdee(USER_ONE, "2026-08-03", "2026-08-06", "3000");
        insertProteinGoal(USER_ONE, "2026-08-01", "2026-08-05", true, "WARNING");
        insertProteinGoal(USER_ONE, "2026-08-05", null, false, "POSITIVE");

        insertDiary(USER_ONE, "2026-08-01", "CLOSED", false,
                List.of(
                        new Food("1200", "100", "110", "30", "12"),
                        new Food("800", "60", "90", "20", "8")),
                List.of("400", "600"));
        insertDiary(USER_ONE, "2026-08-02", "CLOSED", true, List.of(), List.of());
        insertDiary(USER_ONE, "2026-08-03", "OPEN", false,
                List.of(new Food("500", "40", "50", "15", "5")), List.of("250"));
        insertDiary(USER_ONE, "2026-08-04", "CLOSED", false, List.of(), List.of("500"));
        insertDiary(USER_ONE, "2026-08-05", "CLOSED", false,
                List.of(new Food("3500", "200", "400", "120", "30")), List.of());
        insertDiary(USER_ONE, "2026-08-06", "CLOSED", false,
                List.of(new Food("2500", "180", "250", "80", "25")), List.of());

        insertWeight(USER_ONE, "2026-08-01", "90");
        insertWeight(USER_ONE, "2026-08-03", "89");
        insertWeight(USER_ONE, "2026-08-05", "88");
        insertWorkout(USER_ONE, "2026-08-01", "9999");

        insertTdee(USER_TWO, "2026-08-01", null, "3000");
        insertDiary(USER_TWO, "2026-08-01", "CLOSED", false,
                List.of(new Food("9999", "1", "1", "1", "1")), List.of("9999"));
    }

    @Test
    @WithMockUser(username = "analytics-user")
    void monthlyUsesClosedDenominatorsVersionedPlanningAndIndependentAggregates() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/monthly").queryParam("month", "2026-08"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-08"))
                .andExpect(jsonPath("$.throughDate").value("2026-08-12"))
                .andExpect(jsonPath("$.elapsedCalendarDays").value(12))
                .andExpect(jsonPath("$.closedDays").value(5))
                .andExpect(jsonPath("$.openDays").value(1))
                .andExpect(jsonPath("$.missingDiaryDays").value(6))
                .andExpect(jsonPath("$.nutrition.caloriesKcal.total").value(8000.0))
                .andExpect(jsonPath("$.nutrition.caloriesKcal.average").value(2000.0))
                .andExpect(jsonPath("$.nutrition.caloriesKcal.sampleCount").value(4))
                .andExpect(jsonPath("$.nutrition.waterMl.total").value(1500.0))
                .andExpect(jsonPath("$.nutrition.waterMl.average").value(750.0))
                .andExpect(jsonPath("$.nutrition.waterMl.sampleCount").value(2))
                .andExpect(jsonPath("$.energy.netBalanceKcal").value(-2500.0))
                .andExpect(jsonPath("$.energy.deficitMagnitudeKcal").value(3000.0))
                .andExpect(jsonPath("$.energy.surplusKcal").value(500.0))
                .andExpect(jsonPath("$.energy.eligibleDays").value(3))
                .andExpect(jsonPath("$.energy.missingTdeeDays").value(1))
                .andExpect(jsonPath("$.energy.missingNutritionDays").value(1))
                .andExpect(jsonPath("$.energy.deficitDays").value(2))
                .andExpect(jsonPath("$.energy.surplusDays").value(1))
                .andExpect(jsonPath("$.energy.largestDeficit.date").value("2026-08-02"))
                .andExpect(jsonPath("$.energy.largestDeficit.balanceKcal").value(-2500.0))
                .andExpect(jsonPath("$.energy.largestSurplus.date").value("2026-08-05"))
                .andExpect(jsonPath("$.energy.largestSurplus.balanceKcal").value(500.0))
                .andExpect(jsonPath("$.workouts.sessionCount").value(1))
                .andExpect(jsonPath("$.goalAttainment[0].nutrient").value("PROTEIN"))
                .andExpect(jsonPath("$.goalAttainment[0].attainedDays").value(1))
                .andExpect(jsonPath("$.goalAttainment[0].eligibleDays").value(4))
                .andExpect(jsonPath("$.goalAttainment[0].attainedPercentage").value(25.0));
    }

    @Test
    @WithMockUser(username = "analytics-user")
    void dailyAndSeriesExposeOpenFastingAndMissingReasonsWithoutInventingValues() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/daily").queryParam("date", "2026-08-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diaryStatus").value("OPEN"))
                .andExpect(jsonPath("$.historicalEligible").value(false))
                .andExpect(jsonPath("$.nutrition.caloriesKcal").value(500.0))
                .andExpect(jsonPath("$.weightKg").value(89.0))
                .andExpect(jsonPath("$.energyBalanceAvailability").value("OPEN_LOG"))
                .andExpect(jsonPath("$.energyBalanceKcal").doesNotExist())
                .andExpect(jsonPath("$.projectedEnergyBalanceKcal").value(-2500.0))
                .andExpect(jsonPath("$.goalProgress[0].nutrient").value("PROTEIN"))
                .andExpect(jsonPath("$.goalProgress[0].value").value(40.0))
                .andExpect(jsonPath("$.goalProgress[0].reference.label").value("Meta"))
                .andExpect(jsonPath("$.goalProgress[0].reference.minValue").value(150.0))
                .andExpect(jsonPath("$.goalProgress[0].reference.maxValue").doesNotExist())
                .andExpect(jsonPath("$.goalProgress[0].reference.remainingToRange").value(110.0))
                .andExpect(jsonPath("$.goalProgress[0].reference.excessOverRange").doesNotExist());

        mockMvc.perform(get("/api/v1/analytics/daily").queryParam("date", "2026-08-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nutrition.caloriesKcal").value(2000.0))
                .andExpect(jsonPath("$.tdeeKcal").value(2500.0))
                .andExpect(jsonPath("$.energyBalanceKcal").value(-500.0))
                .andExpect(jsonPath("$.projectedEnergyBalanceKcal").doesNotExist())
                .andExpect(jsonPath("$.workouts.sessionCount").value(1));

        mockMvc.perform(get("/api/v1/analytics/daily").queryParam("date", "2026-08-02"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fastingConfirmed").value(true))
                .andExpect(jsonPath("$.nutrition.caloriesKcal").value(0.0))
                .andExpect(jsonPath("$.nutrition.waterMl").doesNotExist())
                .andExpect(jsonPath("$.energyBalanceAvailability").value("AVAILABLE"))
                .andExpect(jsonPath("$.energyBalanceKcal").value(-2500.0));

        mockMvc.perform(get("/api/v1/analytics/daily").queryParam("date", "2026-08-07"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diaryStatus").value("MISSING"))
                .andExpect(jsonPath("$.nutrition.caloriesKcal").doesNotExist())
                .andExpect(jsonPath("$.nutrition.waterMl").doesNotExist())
                .andExpect(jsonPath("$.energyBalanceAvailability").value("MISSING_LOG"));

        mockMvc.perform(get("/api/v1/analytics/series")
                        .queryParam("metric", "CALORIES")
                        .queryParam("from", "2026-08-01")
                        .queryParam("to", "2026-08-06"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.points.length()").value(6))
                .andExpect(jsonPath("$.points[0].value").value(2000.0))
                .andExpect(jsonPath("$.points[1].value").value(0.0))
                .andExpect(jsonPath("$.points[2].availability").value("OPEN_LOG"))
                .andExpect(jsonPath("$.points[3].availability").value("MISSING_VALUE"));

        mockMvc.perform(get("/api/v1/analytics/series")
                        .queryParam("metric", "ENERGY_BALANCE")
                        .queryParam("from", "2026-08-03")
                        .queryParam("to", "2026-08-06"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.points[0].availability").value("OPEN_LOG"))
                .andExpect(jsonPath("$.points[1].availability").value("MISSING_VALUE"))
                .andExpect(jsonPath("$.points[3].availability").value("MISSING_TDEE"));

        mockMvc.perform(get("/api/v1/analytics/series")
                        .queryParam("metric", "WEIGHT")
                        .queryParam("from", "2026-08-01")
                        .queryParam("to", "2026-08-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.points[0].availability").value("AVAILABLE"))
                .andExpect(jsonPath("$.points[1].availability").value("MISSING_VALUE"))
                .andExpect(jsonPath("$.points[2].availability").value("AVAILABLE"))
                .andExpect(jsonPath("$.points[2].value").value(89.0));
    }

    @Test
    @WithMockUser(username = "analytics-user")
    void currentZoneBoundsFutureMonthAndTenantIsolationRemainExplicit() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/bounds"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.earliestDate").value("2026-08-01"))
                .andExpect(jsonPath("$.latestDate").value("2026-08-06"))
                .andExpect(jsonPath("$.today").value("2026-08-12"));

        mockMvc.perform(get("/api/v1/analytics/monthly").queryParam("month", "2026-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.throughDate").doesNotExist())
                .andExpect(jsonPath("$.elapsedCalendarDays").value(0))
                .andExpect(jsonPath("$.missingDiaryDays").value(0));

        mockMvc.perform(get("/api/v1/analytics/monthly").queryParam("month", "2026-07"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.throughDate").value("2026-07-31"))
                .andExpect(jsonPath("$.elapsedCalendarDays").value(31))
                .andExpect(jsonPath("$.missingDiaryDays").value(31))
                .andExpect(jsonPath("$.nutrition.caloriesKcal.sampleCount").value(0));

        authenticate(USER_TWO);
        mockMvc.perform(get("/api/v1/analytics/monthly").queryParam("month", "2026-08"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nutrition.caloriesKcal.total").value(9999.0))
                .andExpect(jsonPath("$.closedDays").value(1));
    }

    @Test
    @WithMockUser(username = "analytics-user")
    void oversizedSeriesUsesProblemDetails() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/series")
                        .queryParam("metric", "CALORIES")
                        .queryParam("from", "2024-01-01")
                        .queryParam("to", "2025-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("ANALYTICS_VALIDATION"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("to"));

        mockMvc.perform(get("/api/v1/analytics/monthly").queryParam("month", "2026-99"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        mockMvc.perform(get("/api/v1/analytics/series")
                        .queryParam("metric", "UNKNOWN")
                        .queryParam("from", "2026-08-01")
                        .queryParam("to", "2026-08-02"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        mockMvc.perform(get("/api/v1/analytics/series")
                        .queryParam("metric", "CALORIES")
                        .queryParam("from", "2026-08-02")
                        .queryParam("to", "2026-08-01"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("ANALYTICS_VALIDATION"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("to"));

        mockMvc.perform(get("/api/v1/analytics/daily").queryParam("date", "not-a-date"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void analyticsRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/bounds"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    @WithMockUser(username = "api-doc-owner", roles = "OWNER")
    void openApiPublishesEveryAnalyticsOperation() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/analytics/daily'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/analytics/monthly'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/analytics/series'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/analytics/bounds'].get").exists());
    }

    private void insertDiary(
            UUID userId,
            String date,
            String status,
            boolean fasting,
            List<Food> foods,
            List<String> waterVolumes) {
        UUID logId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO daily_logs
                    (id, user_id, log_date, status, created_at, updated_at, closed_at, version)
                VALUES (?, ?, ?::date, ?, now(), now(), CASE WHEN ? = 'CLOSED' THEN now() END, 0)
                """, logId, userId, date, status, status);
        jdbcTemplate.update("""
                INSERT INTO daily_log_state_events
                    (id, daily_log_id, event_type, event_order, fasting_confirmed, actor_user_id, occurred_at)
                VALUES (?, ?, 'CREATED', 0, false, ?, now())
                """, UUID.randomUUID(), logId, userId);
        if ("CLOSED".equals(status)) {
            jdbcTemplate.update("""
                    INSERT INTO daily_log_state_events
                        (id, daily_log_id, event_type, event_order, fasting_confirmed, actor_user_id, occurred_at)
                    VALUES (?, ?, 'CLOSED', 1, ?, ?, now())
                    """, UUID.randomUUID(), logId, fasting, userId);
        }
        if (!foods.isEmpty()) {
            UUID mealId = UUID.randomUUID();
            jdbcTemplate.update("""
                    INSERT INTO meals (id, daily_log_id, name, position, created_at, updated_at)
                    VALUES (?, ?, 'Teste', 0, now(), now())
                    """, mealId, logId);
            for (int position = 0; position < foods.size(); position++) {
                Food food = foods.get(position);
                jdbcTemplate.update("""
                        INSERT INTO meal_items
                            (id, meal_id, catalog_item_type, catalog_item_version_id, position,
                             quantity, quantity_unit, equivalent_basis_quantity, basis_quantity,
                             base_unit, conversion_factor, snapshot_name, snapshot_kcal,
                             snapshot_protein_g, snapshot_carbohydrate_g, snapshot_fat_g,
                             snapshot_fiber_g, data_quality, created_at, updated_at)
                        VALUES
                            (?, ?, 'FOOD', ?, ?, 1, 'UNIT', 1, 1, 'UNIT', 1,
                             'Snapshot', ?, ?, ?, ?, ?, 'EXACT', now(), now())
                        """,
                        UUID.randomUUID(), mealId, UUID.randomUUID(), position,
                        food.kcal(), food.protein(), food.carbohydrate(), food.fat(), food.fiber());
            }
        }
        for (int index = 0; index < waterVolumes.size(); index++) {
            jdbcTemplate.update("""
                    INSERT INTO water_logs
                        (id, daily_log_id, logged_at, volume_ml, created_at, updated_at)
                    VALUES (?, ?, ?::date + (? * interval '1 hour'), ?, now(), now())
                    """, UUID.randomUUID(), logId, date, index + 8, new BigDecimal(waterVolumes.get(index)));
        }
    }

    private void insertTdee(UUID userId, String from, String to, String kcal) {
        jdbcTemplate.update("""
                INSERT INTO tdee_periods
                    (id, user_id, valid_from, valid_to, kcal_per_day, created_at, updated_at)
                VALUES (?, ?, ?::date, ?::date, ?, now(), now())
                """, UUID.randomUUID(), userId, from, to, new BigDecimal(kcal));
    }

    private void insertProteinGoal(
            UUID userId, String from, String to, boolean countsAsAttained, String tone) {
        UUID periodId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO nutrition_goal_periods
                    (id, user_id, valid_from, valid_to, calorie_target, created_at, updated_at)
                VALUES (?, ?, ?::date, ?::date, 2500, now(), now())
                """, periodId, userId, from, to);
        jdbcTemplate.update("""
                INSERT INTO nutrient_targets (id, goal_period_id, nutrient, unit)
                VALUES (?, ?, 'PROTEIN', 'G')
                """, targetId, periodId);
        jdbcTemplate.update("""
                INSERT INTO goal_bands
                    (id, nutrient_target_id, band_order, min_value, max_value,
                     min_inclusive, max_inclusive, label, tone, counts_as_attained)
                VALUES
                    (?, ?, 0, NULL, 150, false, false, 'Abaixo', 'NEUTRAL', false),
                    (?, ?, 1, 150, NULL, true, false, 'Meta', ?, ?)
                """,
                UUID.randomUUID(), targetId,
                UUID.randomUUID(), targetId, tone, countsAsAttained);
    }

    private void insertWeight(UUID userId, String date, String weight) {
        jdbcTemplate.update("""
                INSERT INTO weight_logs
                    (id, user_id, measurement_date, weight_kg, measured_at, created_at, updated_at, version)
                VALUES (?, ?, ?::date, ?, '08:00', now(), now(), 0)
                """, UUID.randomUUID(), userId, date, new BigDecimal(weight));
    }

    private void insertWorkout(UUID userId, String date, String estimatedKcal) {
        jdbcTemplate.update("""
                INSERT INTO workouts
                    (id, user_id, activity_date, modality, custom_modality, title,
                     duration_minutes, estimated_kcal, created_at, updated_at, version)
                VALUES (?, ?, ?::date, 'WALKING', NULL, 'Caminhada', 60, ?, now(), now(), 0)
                """, UUID.randomUUID(), userId, date, new BigDecimal(estimatedKcal));
    }

    private void authenticate(UUID userId) {
        when(currentUserProvider.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(userId, userId + "@example.test", "Analytics User", UserRole.USER));
    }

    private void createUser(UUID userId, String email, String timeZone) {
        jdbcTemplate.update("""
                INSERT INTO user_accounts
                    (id, email, password_hash, role, status, created_at, updated_at)
                VALUES (?, ?, 'test-only', 'USER', 'ACTIVE', now(), now())
                """, userId, email);
        jdbcTemplate.update("""
                INSERT INTO user_profiles
                    (user_id, display_name, locale, time_zone, unit_system, created_at, updated_at)
                VALUES (?, 'Analytics User', 'pt-BR', ?, 'METRIC', now(), now())
                """, userId, timeZone);
    }

    private record Food(
            BigDecimal kcal,
            BigDecimal protein,
            BigDecimal carbohydrate,
            BigDecimal fat,
            BigDecimal fiber) {
        private Food(String kcal, String protein, String carbohydrate, String fat, String fiber) {
            this(new BigDecimal(kcal), new BigDecimal(protein), new BigDecimal(carbohydrate),
                    new BigDecimal(fat), new BigDecimal(fiber));
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedClockConfiguration {
        @Bean
        @Primary
        Clock fixedAnalyticsClock() {
            // Still August 12 in America/Sao_Paulo, proving month cutoffs use the profile zone.
            return Clock.fixed(Instant.parse("2026-08-13T01:00:00Z"), ZoneOffset.UTC);
        }
    }
}

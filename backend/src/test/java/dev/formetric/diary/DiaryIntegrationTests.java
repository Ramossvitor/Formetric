package dev.formetric.diary;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import dev.formetric.catalog.CatalogItemType;
import dev.formetric.catalog.CatalogNutritionProvider;
import dev.formetric.catalog.CatalogNutritionSnapshot;
import dev.formetric.catalog.CatalogUnit;
import dev.formetric.catalog.NutrientAmounts;
import dev.formetric.catalog.NutritionQuality;
import dev.formetric.identity.AuthenticatedUser;
import dev.formetric.identity.CurrentUserProvider;
import dev.formetric.identity.CurrentUserZoneIdProvider;
import dev.formetric.identity.UserRole;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@Testcontainers
@Import(DiaryIntegrationTests.FixedClockConfiguration.class)
class DiaryIntegrationTests {

    private static final UUID USER_ONE = UUID.fromString("30000000-0000-0000-0000-000000000001");
    private static final UUID USER_TWO = UUID.fromString("30000000-0000-0000-0000-000000000002");
    private static final UUID VERSION_ID = UUID.fromString("40000000-0000-0000-0000-000000000001");
    private static final UUID SERVING_ID = UUID.fromString("50000000-0000-0000-0000-000000000001");
    private static final LocalDate DATE = LocalDate.of(2026, 8, 12);

    @Container
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired private DiaryService diaryService;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private CurrentUserProvider currentUserProvider;
    @MockitoBean private CurrentUserZoneIdProvider currentUserZoneIdProvider;
    @MockitoBean private CatalogNutritionProvider catalogNutritionProvider;

    @BeforeEach
    void prepareData() {
        jdbcTemplate.update("DELETE FROM user_accounts");
        insertUser(USER_ONE, "diary-one@example.test");
        insertUser(USER_TWO, "diary-two@example.test");
        authenticate(USER_ONE);
        when(currentUserZoneIdProvider.requireCurrentUserZoneId()).thenReturn(ZoneId.of("America/Sao_Paulo"));
        when(catalogNutritionProvider.resolve(
                eq(CatalogItemType.FOOD), eq(VERSION_ID), any(BigDecimal.class), any(CatalogUnit.class), any()))
                .thenAnswer(invocation -> resolvedSnapshot(invocation.getArgument(2), invocation.getArgument(3)));
    }

    @Test
    void emptyFastingClosureIsExplicitAndClosedDiaryRejectsMutationsUntilReopened() {
        assertThrows(DiaryValidationException.class, () -> diaryService.close(DATE, new CloseDailyLogRequest(false)));
        assertThrows(DiaryNotFoundException.class, () -> diaryService.get(DATE));

        DailyLogResponse closed = diaryService.close(DATE, new CloseDailyLogRequest(true));
        assertThat(closed.status()).isEqualTo(DailyLogStatus.CLOSED);
        assertThat(closed.stateEvents().getLast().fastingConfirmed()).isTrue();
        assertThrows(DiaryConflictException.class, () -> diaryService.addWater(
                DATE, new CreateWaterRequest(Instant.parse("2026-08-12T10:00:00Z"), new BigDecimal("250"), null)));

        diaryService.reopen(DATE);
        DailyLogResponse reopened = diaryService.addWater(
                DATE, new CreateWaterRequest(Instant.parse("2026-08-12T10:00:00Z"), new BigDecimal("250"), null));
        assertThat(reopened.status()).isEqualTo(DailyLogStatus.OPEN);
        assertThat(reopened.waterTotalMl()).isEqualByComparingTo("250.000");
    }

    @Test
    void itemUsesImmutableCatalogSnapshotAndCalculatesMealDayWaterAndEnergyTotals() {
        insertTdee(USER_ONE, DATE, new BigDecimal("3000"));
        insertProteinGoal(USER_ONE, DATE);
        UUID mealId = diaryService.addMeal(DATE, new CreateMealRequest("Almoço", null, null, UUID.randomUUID()))
                .meals().getFirst().id();
        UpsertMealItemRequest item = new UpsertMealItemRequest(
                CatalogItemType.FOOD, VERSION_ID, new BigDecimal("2"), CatalogUnit.SLICE, SERVING_ID,
                null, null, null, UUID.randomUUID());

        DailyLogResponse withFood = diaryService.addItem(DATE, mealId, item);
        diaryService.addWater(DATE, new CreateWaterRequest(
                Instant.parse("2026-08-12T12:30:00Z"), new BigDecimal("500"), UUID.randomUUID()));

        assertThat(withFood.totals().kcal()).isEqualByComparingTo("300.000");
        assertThat(withFood.meals().getFirst().totals().proteinG()).isEqualByComparingTo("20.000");
        assertThat(withFood.energyBalanceKcal()).isEqualByComparingTo("-2700.000");
        assertThat(withFood.energyBalanceAvailability()).isEqualTo("AVAILABLE");
        assertThat(withFood.nutritionGoals().calorieTarget()).isEqualByComparingTo("2500.000");
        assertThat(withFood.nutritionGoals().targets().getFirst().bands()).hasSize(2);
        MealItemResponse snapshot = withFood.meals().getFirst().items().getFirst();
        assertThat(snapshot.quantity()).isEqualByComparingTo("2");
        assertThat(snapshot.unit()).isEqualTo("SLICE");
        assertThat(snapshot.equivalentBasisQuantity()).isEqualByComparingTo("100.000");
        assertThat(snapshot.name()).isEqualTo("Pão v1");

        when(catalogNutritionProvider.resolve(any(), any(), any(), any(), any()))
                .thenThrow(new AssertionError("Reading the diary must never resolve catalog data again"));
        DailyLogResponse reread = diaryService.get(DATE);
        assertThat(reread.totals().kcal()).isEqualByComparingTo("300.000");
        assertThat(reread.waterTotalMl()).isEqualByComparingTo("500.000");
    }

    @Test
    void energyBalanceIsUnavailableWithoutEffectiveTdee() {
        diaryService.addMeal(DATE, new CreateMealRequest("Café", null, null, null));

        DailyLogResponse response = diaryService.get(DATE);

        assertThat(response.tdeeKcal()).isNull();
        assertThat(response.energyBalanceKcal()).isNull();
        assertThat(response.energyBalanceAvailability()).isEqualTo("UNAVAILABLE");
    }

    @Test
    void copyOperationsPreserveSnapshotsAndRequestIdMakesCopyIdempotent() {
        UUID mealId = diaryService.addMeal(DATE, new CreateMealRequest("Café", null, null, null))
                .meals().getFirst().id();
        diaryService.addItem(DATE, mealId, new UpsertMealItemRequest(
                CatalogItemType.FOOD, VERSION_ID, new BigDecimal("2"), CatalogUnit.SLICE, SERVING_ID,
                null, DataQuality.ESTIMATED, new BigDecimal("25"), null));
        UUID requestId = UUID.randomUUID();
        LocalDate nextDay = DATE.plusDays(1);
        CopyMealRequest copyRequest = new CopyMealRequest(DATE, mealId, requestId);

        diaryService.copyMeal(nextDay, copyRequest);
        DailyLogResponse replay = diaryService.copyMeal(nextDay, copyRequest);

        assertThat(replay.meals()).hasSize(1);
        assertThat(replay.meals().getFirst().items().getFirst().dataQuality()).isEqualTo(DataQuality.ESTIMATED);
        assertThat(replay.meals().getFirst().items().getFirst().uncertaintyKcal()).isEqualByComparingTo("25.000");

        DailyLogResponse duplicated = diaryService.copyDay(nextDay.plusDays(1), new CopyDayRequest(nextDay, UUID.randomUUID()));
        assertThat(duplicated.meals()).hasSize(1);
        assertThat(duplicated.totals().kcal()).isEqualByComparingTo("300.000");
    }

    @Test
    void requestIdRejectsDifferentPayloadButAcceptsEquivalentDecimalRepresentation() {
        UUID mealRequestId = UUID.randomUUID();
        DailyLogResponse original = diaryService.addMeal(
                DATE, new CreateMealRequest("Almoço", null, null, mealRequestId));

        DailyLogResponse replay = diaryService.addMeal(
                DATE, new CreateMealRequest("Almoço", null, null, mealRequestId));

        assertThat(replay.meals()).hasSize(1);
        assertThat(replay.id()).isEqualTo(original.id());
        assertThrows(DiaryConflictException.class, () -> diaryService.addMeal(
                DATE, new CreateMealRequest("Jantar", null, null, mealRequestId)));

        UUID mealId = original.meals().getFirst().id();
        UUID itemRequestId = UUID.randomUUID();
        diaryService.addItem(DATE, mealId, new UpsertMealItemRequest(
                CatalogItemType.FOOD, VERSION_ID, new BigDecimal("2.0"), CatalogUnit.SLICE, SERVING_ID,
                null, null, null, itemRequestId));
        DailyLogResponse equivalentReplay = diaryService.addItem(DATE, mealId, new UpsertMealItemRequest(
                CatalogItemType.FOOD, VERSION_ID, new BigDecimal("2.000"), CatalogUnit.SLICE, SERVING_ID,
                null, null, null, itemRequestId));

        assertThat(equivalentReplay.meals().getFirst().items()).hasSize(1);
    }

    @Test
    void updateMealWithoutPositionPreservesItsCurrentPosition() {
        UUID firstId = diaryService.addMeal(
                DATE, new CreateMealRequest("Primeira", 3, null, null)).meals().getFirst().id();

        DailyLogResponse updated = diaryService.updateMeal(
                DATE, firstId, new UpdateMealRequest("Renomeada", null, null));

        assertThat(updated.meals().getFirst().name()).isEqualTo("Renomeada");
        assertThat(updated.meals().getFirst().position()).isEqualTo(3);
    }

    @Test
    void waterTimestampMustBelongToDiaryDateInProfileTimeZone() {
        assertThrows(DiaryValidationException.class, () -> diaryService.addWater(
                DATE,
                new CreateWaterRequest(
                        Instant.parse("2026-08-12T02:30:00Z"), new BigDecimal("250"), UUID.randomUUID())));

        DailyLogResponse response = diaryService.addWater(
                DATE,
                new CreateWaterRequest(
                        Instant.parse("2026-08-12T03:30:00Z"), new BigDecimal("250"), UUID.randomUUID()));

        assertThat(response.waterLogs()).hasSize(1);
    }

    @Test
    void copyDayPreservesCivilWaterTimeAcrossDaylightSavingTransition() {
        ZoneId newYork = ZoneId.of("America/New_York");
        when(currentUserZoneIdProvider.requireCurrentUserZoneId()).thenReturn(newYork);
        LocalDate sourceDate = LocalDate.of(2026, 3, 7);
        LocalDate targetDate = LocalDate.of(2026, 3, 9);
        Instant sourceInstant = sourceDate.atTime(1, 30).atZone(newYork).toInstant();
        diaryService.addWater(sourceDate, new CreateWaterRequest(sourceInstant, new BigDecimal("500"), null));

        DailyLogResponse copied = diaryService.copyDay(
                targetDate, new CopyDayRequest(sourceDate, UUID.randomUUID()));

        Instant copiedInstant = copied.waterLogs().getFirst().loggedAt();
        assertThat(copiedInstant.atZone(newYork).toLocalDate()).isEqualTo(targetDate);
        assertThat(copiedInstant.atZone(newYork).toLocalTime()).isEqualTo(sourceInstant.atZone(newYork).toLocalTime());
        assertThat(copiedInstant).isEqualTo(Instant.parse("2026-03-09T05:30:00Z"));
    }

    @Test
    void usersCannotReadOrMutateEachOthersDiary() {
        diaryService.addMeal(DATE, new CreateMealRequest("Privado", null, null, null));

        authenticate(USER_TWO);
        assertThrows(DiaryNotFoundException.class, () -> diaryService.get(DATE));
        DailyLogResponse secondUsersLog = diaryService.addMeal(
                DATE, new CreateMealRequest("Do segundo usuário", null, null, null));

        assertThat(secondUsersLog.meals()).extracting(MealResponse::name).containsExactly("Do segundo usuário");
        authenticate(USER_ONE);
        assertThat(diaryService.get(DATE).meals()).extracting(MealResponse::name).containsExactly("Privado");
    }

    @Test
    void concurrentFirstWritesCreateOneDailyLogWithoutLosingEitherMeal() throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> concurrentMeal("Café", ready, start));
            var second = executor.submit(() -> concurrentMeal("Almoço", ready, start));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
        }

        DailyLogResponse log = diaryService.get(DATE);
        assertThat(log.meals()).extracting(MealResponse::name).containsExactlyInAnyOrder("Café", "Almoço");
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM daily_logs WHERE user_id = ? AND log_date = ?", Integer.class, USER_ONE, DATE);
        assertThat(count).isEqualTo(1);
    }

    private void concurrentMeal(String name, CountDownLatch ready, CountDownLatch start) {
        try {
            ready.countDown();
            start.await();
            diaryService.addMeal(DATE, new CreateMealRequest(name, null, null, UUID.randomUUID()));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    private static CatalogNutritionSnapshot resolvedSnapshot(BigDecimal inputQuantity, CatalogUnit inputUnit) {
        return new CatalogNutritionSnapshot(
                VERSION_ID, CatalogItemType.FOOD, "Pão v1", inputQuantity, inputUnit, SERVING_ID,
                new BigDecimal("100.000"), new BigDecimal("100.000"), CatalogUnit.G,
                new NutrientAmounts(new BigDecimal("300.000"), new BigDecimal("20.000"),
                        new BigDecimal("40.000"), new BigDecimal("5.000"), new BigDecimal("3.000"),
                        new BigDecimal("400.000")),
                NutritionQuality.EXACT, null);
    }

    private void authenticate(UUID userId) {
        when(currentUserProvider.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(userId, userId + "@example.test", "Diary User", UserRole.USER));
    }

    private void insertUser(UUID userId, String email) {
        jdbcTemplate.update("""
                INSERT INTO user_accounts (id, email, password_hash, role, status, created_at, updated_at)
                VALUES (?, ?, 'test-only', 'USER', 'ACTIVE', now(), now())
                """, userId, email);
    }

    private void insertTdee(UUID userId, LocalDate from, BigDecimal kcal) {
        jdbcTemplate.update("""
                INSERT INTO tdee_periods (id, user_id, valid_from, valid_to, kcal_per_day, created_at, updated_at)
                VALUES (?, ?, ?, NULL, ?, now(), now())
                """, UUID.randomUUID(), userId, from, kcal);
    }

    private void insertProteinGoal(UUID userId, LocalDate from) {
        UUID periodId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO nutrition_goal_periods
                    (id, user_id, valid_from, valid_to, calorie_target, created_at, updated_at)
                VALUES (?, ?, ?, NULL, 2500, now(), now())
                """, periodId, userId, from);
        jdbcTemplate.update("""
                INSERT INTO nutrient_targets (id, goal_period_id, nutrient, unit)
                VALUES (?, ?, 'PROTEIN', 'G')
                """, targetId, periodId);
        jdbcTemplate.update("""
                INSERT INTO goal_bands
                    (id, nutrient_target_id, band_order, min_value, max_value,
                     min_inclusive, max_inclusive, label, tone)
                VALUES
                    (?, ?, 0, NULL, 175, FALSE, FALSE, 'Abaixo', 'WARNING'),
                    (?, ?, 1, 175, NULL, TRUE, FALSE, 'Meta', 'POSITIVE')
                """, UUID.randomUUID(), targetId, UUID.randomUUID(), targetId);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedClockConfiguration {
        @Bean @Primary
        Clock fixedDiaryTestClock() {
            return Clock.fixed(Instant.parse("2026-08-12T12:00:00Z"), ZoneOffset.UTC);
        }
    }
}

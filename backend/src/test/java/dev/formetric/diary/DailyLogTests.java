package dev.formetric.diary;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import dev.formetric.catalog.CatalogItemType;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DailyLogTests {

    private static final Instant NOW = Instant.parse("2026-08-12T12:00:00Z");

    @Test
    void emptyDayNeedsFastingConfirmationAndStateChangesAreAudited() {
        DailyLog log = DailyLog.create(UUID.randomUUID(), LocalDate.of(2026, 8, 12), NOW);

        assertThrows(DiaryValidationException.class, () -> log.close(false, NOW.plusSeconds(1)));
        log.close(true, NOW.plusSeconds(2));

        assertThat(log.status()).isEqualTo(DailyLogStatus.CLOSED);
        assertThat(log.stateEvents()).extracting(event -> event.eventType().name())
                .containsExactly("CREATED", "CLOSED");
        assertThat(log.stateEvents().getLast().fastingConfirmed()).isTrue();
        assertThrows(DiaryConflictException.class, () -> log.addWater(NOW, new BigDecimal("250"), NOW));

        log.reopen(NOW.plusSeconds(3));
        assertThat(log.status()).isEqualTo(DailyLogStatus.OPEN);
        assertThat(log.stateEvents().getLast().eventType()).isEqualTo(DailyLogStateEvent.EventType.REOPENED);
    }

    @Test
    void waterOnlyDayCanCloseWithoutFastingConfirmation() {
        DailyLog log = DailyLog.create(UUID.randomUUID(), LocalDate.of(2026, 8, 12), NOW);
        log.addWater(NOW, new BigDecimal("500"), NOW);

        log.close(false, NOW.plusSeconds(1));

        assertThat(log.status()).isEqualTo(DailyLogStatus.CLOSED);
        assertThat(log.stateEvents().getLast().fastingConfirmed()).isFalse();
    }

    @Test
    void dayWithFoodCannotBeMisclassifiedAsFasting() {
        DailyLog log = DailyLog.create(UUID.randomUUID(), LocalDate.of(2026, 8, 12), NOW);
        Meal meal = log.addMeal("Almoço", 0, null, NOW);
        meal.addItem(snapshot("Arroz", "130", "2", "28", "0.3", "1", "2", "1"),
                0, DataQuality.EXACT, null, NOW);

        DiaryValidationException exception = assertThrows(
                DiaryValidationException.class,
                () -> log.close(true, NOW.plusSeconds(1)));

        assertThat(exception.field()).isEqualTo("fastingConfirmed");
        assertThat(log.status()).isEqualTo(DailyLogStatus.OPEN);
        assertThat(log.stateEvents()).extracting(event -> event.eventType().name())
                .containsExactly("CREATED");
    }

    @Test
    void totalsUseStoredSnapshotsAndKeepUnknownSodiumUnknown() {
        DailyLog log = DailyLog.create(UUID.randomUUID(), LocalDate.of(2026, 8, 12), NOW);
        Meal meal = log.addMeal("Almoço", 0, null, NOW);
        meal.addItem(snapshot("Arroz", "130", "2", "28", "0.3", "1", "2", "1"),
                0, DataQuality.EXACT, null, NOW);
        meal.addItem(snapshot("Restaurante", "500", "30", "40", "20", "5", null, "1"),
                1, DataQuality.ESTIMATED, new BigDecimal("100"), NOW);

        DiaryTotals totals = DiaryTotals.forMeals(log.meals());

        assertThat(totals.kcal()).isEqualByComparingTo("630.000");
        assertThat(totals.proteinG()).isEqualByComparingTo("32.000");
        assertThat(totals.carbohydrateG()).isEqualByComparingTo("68.000");
        assertThat(totals.sodiumMg()).isNull();
    }

    @Test
    void copiedMealPreservesSnapshotAndQuality() {
        DailyLog source = DailyLog.create(UUID.randomUUID(), LocalDate.of(2026, 8, 11), NOW);
        Meal sourceMeal = source.addMeal("Café", 0, null, NOW);
        sourceMeal.addItem(snapshot("Whey v1", "112", "27", "1.5", "0.8", "0", "70", "1.4"),
                0, DataQuality.HIGHLY_ESTIMATED, new BigDecimal("20"), NOW);
        DailyLog target = DailyLog.create(source.userId(), LocalDate.of(2026, 8, 12), NOW);

        Meal copy = target.copyMeal(sourceMeal, NOW);
        MealItem copiedItem = copy.items().getFirst();

        assertThat(copiedItem.name()).isEqualTo("Whey v1");
        assertThat(copiedItem.kcal()).isEqualByComparingTo("112");
        assertThat(copiedItem.dataQuality()).isEqualTo(DataQuality.HIGHLY_ESTIMATED);
        assertThat(copiedItem.uncertaintyKcal()).isEqualByComparingTo("20");
    }

    @Test
    void closedDayRejectsReplacingAnExistingItem() {
        DailyLog log = DailyLog.create(UUID.randomUUID(), LocalDate.of(2026, 8, 12), NOW);
        Meal meal = log.addMeal("Almoço", 0, null, NOW);
        MealItem item = meal.addItem(snapshot("Arroz", "130", "2", "28", "0.3", "1", "2", "1"),
                0, DataQuality.EXACT, null, NOW);
        log.close(false, NOW.plusSeconds(1));

        assertThrows(DiaryConflictException.class, () -> item.replace(
                snapshot("Arroz alterado", "200", "2", "30", "1", "1", "2", "1"),
                0,
                DataQuality.EXACT,
                null,
                NOW.plusSeconds(2)));
    }

    private static MealItemSnapshot snapshot(
            String name, String kcal, String protein, String carbs, String fat, String fiber, String sodium,
            String conversionFactor) {
        return new MealItemSnapshot(
                CatalogItemType.FOOD,
                UUID.randomUUID(),
                null,
                new BigDecimal("100"),
                "G",
                new BigDecimal("100"),
                new BigDecimal("100"),
                "G",
                new BigDecimal(conversionFactor),
                name,
                new BigDecimal(kcal),
                new BigDecimal(protein),
                new BigDecimal(carbs),
                new BigDecimal(fat),
                new BigDecimal(fiber),
                sodium == null ? null : new BigDecimal(sodium));
    }
}

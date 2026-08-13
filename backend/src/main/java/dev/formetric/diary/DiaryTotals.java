package dev.formetric.diary;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;

record DiaryTotals(
        BigDecimal kcal,
        BigDecimal proteinG,
        BigDecimal carbohydrateG,
        BigDecimal fatG,
        BigDecimal fiberG,
        BigDecimal sodiumMg) {

    private static final int SCALE = 3;

    static DiaryTotals forItems(Collection<MealItem> items) {
        BigDecimal kcal = BigDecimal.ZERO;
        BigDecimal protein = BigDecimal.ZERO;
        BigDecimal carbohydrate = BigDecimal.ZERO;
        BigDecimal fat = BigDecimal.ZERO;
        BigDecimal fiber = BigDecimal.ZERO;
        BigDecimal sodium = BigDecimal.ZERO;
        boolean sodiumComplete = true;
        for (MealItem item : items) {
            kcal = kcal.add(item.kcal());
            protein = protein.add(item.proteinG());
            carbohydrate = carbohydrate.add(item.carbohydrateG());
            fat = fat.add(item.fatG());
            fiber = fiber.add(item.fiberG());
            if (item.sodiumMg() == null) sodiumComplete = false;
            else sodium = sodium.add(item.sodiumMg());
        }
        return new DiaryTotals(normalize(kcal), normalize(protein), normalize(carbohydrate), normalize(fat),
                normalize(fiber), sodiumComplete ? normalize(sodium) : null);
    }

    static DiaryTotals forMeals(Collection<Meal> meals) {
        return forItems(meals.stream().flatMap(meal -> meal.items().stream()).toList());
    }

    private static BigDecimal normalize(BigDecimal value) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
    }
}

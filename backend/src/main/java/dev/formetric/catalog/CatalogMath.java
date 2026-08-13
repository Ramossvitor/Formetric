package dev.formetric.catalog;

import java.math.BigDecimal;
import java.math.RoundingMode;

final class CatalogMath {
    static final int SCALE = 3;
    static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

    private CatalogMath() {
    }

    static BigDecimal value(BigDecimal value) {
        return value.setScale(SCALE, ROUNDING);
    }

    static BigDecimal nullableValue(BigDecimal value) {
        return value == null ? null : value(value);
    }

    static BigDecimal proportional(BigDecimal source, BigDecimal multiplier, BigDecimal divisor) {
        if (source == null) {
            return null;
        }
        return source.multiply(multiplier).divide(divisor, SCALE, ROUNDING);
    }

    static NutrientAmounts scale(NutrientAmounts source, BigDecimal multiplier, BigDecimal divisor) {
        return new NutrientAmounts(
                proportional(source.caloriesKcal(), multiplier, divisor),
                proportional(source.proteinG(), multiplier, divisor),
                proportional(source.carbohydrateG(), multiplier, divisor),
                proportional(source.fatG(), multiplier, divisor),
                proportional(source.fiberG(), multiplier, divisor),
                proportional(source.sodiumMg(), multiplier, divisor));
    }

    static NutrientAmounts zero() {
        var zero = BigDecimal.ZERO.setScale(SCALE);
        return new NutrientAmounts(zero, zero, zero, zero, zero, zero);
    }

    static NutrientAmounts add(NutrientAmounts left, NutrientAmounts right) {
        return new NutrientAmounts(
                value(left.caloriesKcal().add(right.caloriesKcal())),
                value(left.proteinG().add(right.proteinG())),
                value(left.carbohydrateG().add(right.carbohydrateG())),
                value(left.fatG().add(right.fatG())),
                value(left.fiberG().add(right.fiberG())),
                addNullable(left.sodiumMg(), right.sodiumMg()));
    }

    private static BigDecimal addNullable(BigDecimal left, BigDecimal right) {
        if (left == null || right == null) {
            return null;
        }
        return value(left.add(right));
    }
}

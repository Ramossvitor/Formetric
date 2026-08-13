package dev.formetric.catalog;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "food_versions")
class FoodVersion {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "food_id", nullable = false, updatable = false)
    private FoodItem food;

    @Column(name = "version_number", nullable = false, updatable = false)
    private int versionNumber;

    @Column(nullable = false, length = 160, updatable = false)
    private String name;

    @Column(length = 120, updatable = false)
    private String brand;

    @Column(length = 1000, updatable = false)
    private String notes;

    @Column(name = "reference_quantity", precision = 14, scale = 3, nullable = false, updatable = false)
    private BigDecimal referenceQuantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "reference_unit", nullable = false, updatable = false)
    private CatalogUnit referenceUnit;

    @Column(name = "calories_kcal", precision = 14, scale = 3, nullable = false, updatable = false)
    private BigDecimal caloriesKcal;
    @Column(name = "protein_g", precision = 14, scale = 3, nullable = false, updatable = false)
    private BigDecimal proteinG;
    @Column(name = "carbohydrate_g", precision = 14, scale = 3, nullable = false, updatable = false)
    private BigDecimal carbohydrateG;
    @Column(name = "fat_g", precision = 14, scale = 3, nullable = false, updatable = false)
    private BigDecimal fatG;
    @Column(name = "fiber_g", precision = 14, scale = 3, nullable = false, updatable = false)
    private BigDecimal fiberG;
    @Column(name = "sodium_mg", precision = 14, scale = 3, updatable = false)
    private BigDecimal sodiumMg;

    @Enumerated(EnumType.STRING)
    @Column(name = "nutrition_quality", nullable = false, updatable = false)
    private NutritionQuality quality;

    @Column(name = "kcal_uncertainty", precision = 14, scale = 3, updatable = false)
    private BigDecimal kcalUncertainty;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "foodVersion", cascade = CascadeType.ALL, orphanRemoval = false, fetch = FetchType.LAZY)
    @OrderBy("position ASC")
    private List<FoodServingOption> servings = new ArrayList<>();

    protected FoodVersion() {
    }

    FoodVersion(FoodItem food, int number, FoodVersionDefinition definition, Instant now) {
        this.id = UUID.randomUUID();
        this.food = food;
        this.versionNumber = number;
        this.name = definition.name();
        this.brand = definition.brand();
        this.notes = definition.notes();
        this.referenceQuantity = CatalogMath.value(definition.referenceQuantity());
        this.referenceUnit = definition.referenceUnit();
        this.caloriesKcal = CatalogMath.value(definition.caloriesKcal());
        this.proteinG = CatalogMath.value(definition.proteinG());
        this.carbohydrateG = CatalogMath.value(definition.carbohydrateG());
        this.fatG = CatalogMath.value(definition.fatG());
        this.fiberG = CatalogMath.value(definition.fiberG());
        this.sodiumMg = CatalogMath.nullableValue(definition.sodiumMg());
        this.quality = definition.quality();
        this.kcalUncertainty = CatalogMath.nullableValue(definition.kcalUncertainty());
        this.createdAt = now;
        for (int position = 0; position < definition.servings().size(); position++) {
            servings.add(new FoodServingOption(this, position, definition.servings().get(position)));
        }
    }

    UUID id() { return id; }
    UUID foodId() { return food.id(); }
    int versionNumber() { return versionNumber; }
    String name() { return name; }
    String brand() { return brand; }
    String notes() { return notes; }
    BigDecimal referenceQuantity() { return referenceQuantity; }
    CatalogUnit referenceUnit() { return referenceUnit; }
    BigDecimal caloriesKcal() { return caloriesKcal; }
    BigDecimal proteinG() { return proteinG; }
    BigDecimal carbohydrateG() { return carbohydrateG; }
    BigDecimal fatG() { return fatG; }
    BigDecimal fiberG() { return fiberG; }
    BigDecimal sodiumMg() { return sodiumMg; }
    NutritionQuality quality() { return quality; }
    BigDecimal kcalUncertainty() { return kcalUncertainty; }
    Instant createdAt() { return createdAt; }
    List<FoodServingOption> servings() { return List.copyOf(servings); }
    NutrientAmounts nutrients() { return new NutrientAmounts(caloriesKcal, proteinG, carbohydrateG, fatG, fiberG, sodiumMg); }
}

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
@Table(name = "recipe_versions")
class RecipeVersion {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipe_id", nullable = false, updatable = false)
    private Recipe recipe;
    @Column(name = "version_number", nullable = false, updatable = false) private int versionNumber;
    @Column(nullable = false, length = 160, updatable = false) private String name;
    @Column(length = 1000, updatable = false) private String notes;
    @Column(name = "yield_quantity", precision = 14, scale = 3, nullable = false, updatable = false)
    private BigDecimal yieldQuantity;
    @Enumerated(EnumType.STRING)
    @Column(name = "yield_unit", nullable = false, updatable = false) private CatalogUnit yieldUnit;
    @Column(name = "serving_quantity", precision = 14, scale = 3, updatable = false)
    private BigDecimal servingQuantity;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @OneToMany(mappedBy = "recipeVersion", cascade = CascadeType.ALL, orphanRemoval = false, fetch = FetchType.LAZY)
    @OrderBy("position ASC")
    private List<RecipeIngredient> ingredients = new ArrayList<>();

    protected RecipeVersion() {}

    RecipeVersion(Recipe recipe, int number, RecipeVersionDefinition definition, Instant now) {
        this.id = UUID.randomUUID();
        this.recipe = recipe;
        this.versionNumber = number;
        this.name = definition.name();
        this.notes = definition.notes();
        this.yieldQuantity = CatalogMath.value(definition.yieldQuantity());
        this.yieldUnit = definition.yieldUnit();
        this.servingQuantity = CatalogMath.nullableValue(definition.servingQuantity());
        this.createdAt = now;
    }

    void addIngredient(RecipeIngredient ingredient) { ingredients.add(ingredient); }
    UUID id() { return id; }
    UUID recipeId() { return recipe.id(); }
    int versionNumber() { return versionNumber; }
    String name() { return name; }
    String notes() { return notes; }
    BigDecimal yieldQuantity() { return yieldQuantity; }
    CatalogUnit yieldUnit() { return yieldUnit; }
    BigDecimal servingQuantity() { return servingQuantity; }
    Instant createdAt() { return createdAt; }
    List<RecipeIngredient> ingredients() { return List.copyOf(ingredients); }
}

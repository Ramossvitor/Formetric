package dev.formetric.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "food_serving_options")
class FoodServingOption {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "food_version_id", nullable = false, updatable = false)
    private FoodVersion foodVersion;
    @Column(nullable = false, updatable = false) private int position;
    @Column(nullable = false, length = 80, updatable = false) private String label;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false) private CatalogUnit unit;
    @Column(precision = 14, scale = 3, nullable = false, updatable = false) private BigDecimal quantity;
    @Column(name = "reference_quantity_equivalent", precision = 14, scale = 3, nullable = false, updatable = false)
    private BigDecimal referenceQuantityEquivalent;

    protected FoodServingOption() {
    }

    FoodServingOption(FoodVersion foodVersion, int position, ServingDefinition definition) {
        this.id = UUID.randomUUID();
        this.foodVersion = foodVersion;
        this.position = position;
        this.label = definition.label();
        this.unit = definition.unit();
        this.quantity = CatalogMath.value(definition.quantity());
        this.referenceQuantityEquivalent = CatalogMath.value(definition.referenceQuantityEquivalent());
    }

    UUID id() { return id; }
    int position() { return position; }
    String label() { return label; }
    CatalogUnit unit() { return unit; }
    BigDecimal quantity() { return quantity; }
    BigDecimal referenceQuantityEquivalent() { return referenceQuantityEquivalent; }
}

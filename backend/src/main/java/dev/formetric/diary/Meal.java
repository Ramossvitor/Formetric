package dev.formetric.diary;

import dev.formetric.catalog.CatalogItemType;
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
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "meals")
class Meal {

    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "daily_log_id", nullable = false)
    private DailyLog dailyLog;
    @Column(nullable = false, length = 80)
    private String name;
    @Column(nullable = false)
    private int position;
    @Column(name = "meal_time")
    private LocalTime mealTime;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "meal", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC, createdAt ASC")
    private List<MealItem> items = new ArrayList<>();

    protected Meal() {}

    private Meal(UUID id, DailyLog dailyLog, String name, int position, LocalTime mealTime, Instant now) {
        this.id = id;
        this.dailyLog = dailyLog;
        this.name = name;
        this.position = position;
        this.mealTime = mealTime;
        this.createdAt = now;
        this.updatedAt = now;
    }

    static Meal create(DailyLog dailyLog, String name, int position, LocalTime mealTime, Instant now) {
        validateName(name);
        if (position < 0) throw new DiaryValidationException("position", "A posição não pode ser negativa.");
        return new Meal(UUID.randomUUID(), dailyLog, name.strip(), position, mealTime, now);
    }

    MealItem addItem(MealItemSnapshot snapshot, int position, DataQuality quality, BigDecimal uncertainty, Instant now) {
        dailyLog.requireOpen();
        if (position < 0) throw new DiaryValidationException("position", "A posição não pode ser negativa.");
        MealItem item = MealItem.create(this, snapshot, position, quality, uncertainty, now);
        items.add(item);
        touch(now);
        return item;
    }

    void update(String name, int position, LocalTime mealTime, Instant now) {
        dailyLog.requireOpen();
        validateName(name);
        if (position < 0) throw new DiaryValidationException("position", "A posição não pode ser negativa.");
        this.name = name.strip();
        this.position = position;
        this.mealTime = mealTime;
        touch(now);
    }

    void reposition(int position, Instant now) {
        this.position = position;
        touch(now);
    }

    void removeItem(MealItem item, Instant now) {
        dailyLog.requireOpen();
        items.remove(item);
        touch(now);
    }

    void requireOpen() {
        dailyLog.requireOpen();
    }

    void reorderItems(List<UUID> itemIds, Instant now) {
        dailyLog.requireOpen();
        if (itemIds.size() != items.size()
                || itemIds.stream().distinct().count() != itemIds.size()
                || !itemIds.containsAll(items.stream().map(MealItem::id).toList())) {
            throw new DiaryValidationException("itemIds", "Informe todos os itens da refeição, sem repetições.");
        }
        for (int position = 0; position < itemIds.size(); position++) {
            itemById(itemIds.get(position)).reposition(position, now);
        }
        items.sort(Comparator.comparingInt(MealItem::position));
        touch(now);
    }

    Meal copyTo(DailyLog targetLog, int targetPosition, Instant now) {
        Meal copy = create(targetLog, name, targetPosition, mealTime, now);
        for (MealItem item : items) {
            copy.items.add(item.copyTo(copy, copy.nextItemPosition(), now));
        }
        return copy;
    }

    MealItem itemById(UUID id) {
        return items.stream().filter(item -> item.id().equals(id)).findFirst()
                .orElseThrow(() -> new DiaryNotFoundException("Item não encontrado nesta refeição."));
    }

    int nextItemPosition() { return items.stream().mapToInt(MealItem::position).max().orElse(-1) + 1; }
    private void touch(Instant now) { updatedAt = now; dailyLog.touch(now); }
    private static void validateName(String name) {
        if (name == null || name.strip().isEmpty() || name.strip().length() > 80) {
            throw new DiaryValidationException("name", "O nome deve possuir entre 1 e 80 caracteres.");
        }
    }
    UUID id() { return id; }
    String name() { return name; }
    int position() { return position; }
    LocalTime mealTime() { return mealTime; }
    List<MealItem> items() { return List.copyOf(items); }
}

@Entity
@Table(name = "meal_items")
class MealItem {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meal_id", nullable = false)
    private Meal meal;
    @Enumerated(EnumType.STRING)
    @Column(name = "catalog_item_type", nullable = false, length = 16)
    private CatalogItemType catalogItemType;
    @Column(name = "catalog_item_version_id", nullable = false)
    private UUID catalogItemVersionId;
    @Column(name = "serving_option_id")
    private UUID servingOptionId;
    @Column(nullable = false) private int position;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal quantity;
    @Column(name = "quantity_unit", nullable = false, length = 24) private String quantityUnit;
    @Column(name = "equivalent_basis_quantity", nullable = false, precision = 14, scale = 3)
    private BigDecimal equivalentBasisQuantity;
    @Column(name = "basis_quantity", nullable = false, precision = 14, scale = 3) private BigDecimal basisQuantity;
    @Column(name = "base_unit", nullable = false, length = 24) private String baseUnit;
    @Column(name = "conversion_factor", nullable = false, precision = 18, scale = 8)
    private BigDecimal conversionFactor;
    @Column(name = "snapshot_name", nullable = false, length = 160) private String snapshotName;
    @Column(name = "snapshot_kcal", nullable = false, precision = 14, scale = 3) private BigDecimal kcal;
    @Column(name = "snapshot_protein_g", nullable = false, precision = 14, scale = 3) private BigDecimal proteinG;
    @Column(name = "snapshot_carbohydrate_g", nullable = false, precision = 14, scale = 3) private BigDecimal carbohydrateG;
    @Column(name = "snapshot_fat_g", nullable = false, precision = 14, scale = 3) private BigDecimal fatG;
    @Column(name = "snapshot_fiber_g", nullable = false, precision = 14, scale = 3) private BigDecimal fiberG;
    @Column(name = "snapshot_sodium_mg", precision = 14, scale = 3) private BigDecimal sodiumMg;
    @Enumerated(EnumType.STRING)
    @Column(name = "data_quality", nullable = false, length = 24) private DataQuality dataQuality;
    @Column(name = "uncertainty_kcal", precision = 14, scale = 3) private BigDecimal uncertaintyKcal;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected MealItem() {}

    private MealItem(Meal meal, MealItemSnapshot s, int position, DataQuality quality, BigDecimal uncertainty, Instant now) {
        this.id = UUID.randomUUID(); this.meal = meal; this.catalogItemType = s.itemType();
        this.catalogItemVersionId = s.versionId(); this.servingOptionId = s.servingOptionId(); this.position = position;
        this.quantity = s.quantity(); this.quantityUnit = s.quantityUnit();
        this.equivalentBasisQuantity = s.equivalentBasisQuantity(); this.basisQuantity = s.basisQuantity();
        this.baseUnit = s.baseUnit(); this.conversionFactor = s.conversionFactor(); this.snapshotName = s.name();
        this.kcal = s.kcal(); this.proteinG = s.proteinG(); this.carbohydrateG = s.carbohydrateG();
        this.fatG = s.fatG(); this.fiberG = s.fiberG(); this.sodiumMg = s.sodiumMg();
        this.dataQuality = quality; this.uncertaintyKcal = uncertainty; this.createdAt = now; this.updatedAt = now;
    }

    static MealItem create(Meal meal, MealItemSnapshot snapshot, int position, DataQuality quality, BigDecimal uncertainty, Instant now) {
        if (quality == null) throw new DiaryValidationException("dataQuality", "A qualidade do dado é obrigatória.");
        if (uncertainty != null && uncertainty.signum() < 0) {
            throw new DiaryValidationException("uncertaintyKcal", "A incerteza não pode ser negativa.");
        }
        return new MealItem(meal, snapshot, position, quality, uncertainty, now);
    }

    MealItem copyTo(Meal target, int targetPosition, Instant now) {
        return create(target, snapshot(), targetPosition, dataQuality, uncertaintyKcal, now);
    }

    void replace(MealItemSnapshot snapshot, int position, DataQuality quality, BigDecimal uncertainty, Instant now) {
        meal.requireOpen();
        if (quality == null) throw new DiaryValidationException("dataQuality", "A qualidade do dado é obrigatória.");
        if (uncertainty != null && uncertainty.signum() < 0) throw new DiaryValidationException("uncertaintyKcal", "A incerteza não pode ser negativa.");
        this.catalogItemType = snapshot.itemType(); this.catalogItemVersionId = snapshot.versionId();
        this.servingOptionId = snapshot.servingOptionId(); this.position = position; this.quantity = snapshot.quantity();
        this.quantityUnit = snapshot.quantityUnit(); this.equivalentBasisQuantity = snapshot.equivalentBasisQuantity();
        this.basisQuantity = snapshot.basisQuantity(); this.baseUnit = snapshot.baseUnit();
        this.conversionFactor = snapshot.conversionFactor(); this.snapshotName = snapshot.name(); this.kcal = snapshot.kcal();
        this.proteinG = snapshot.proteinG(); this.carbohydrateG = snapshot.carbohydrateG(); this.fatG = snapshot.fatG();
        this.fiberG = snapshot.fiberG(); this.sodiumMg = snapshot.sodiumMg(); this.dataQuality = quality;
        this.uncertaintyKcal = uncertainty; this.updatedAt = now;
    }
    void reposition(int position, Instant now) { this.position = position; this.updatedAt = now; }
    MealItemSnapshot snapshot() { return new MealItemSnapshot(catalogItemType, catalogItemVersionId, servingOptionId, quantity,
            quantityUnit, equivalentBasisQuantity, basisQuantity, baseUnit, conversionFactor, snapshotName, kcal,
            proteinG, carbohydrateG, fatG, fiberG, sodiumMg); }
    UUID id() { return id; } int position() { return position; } CatalogItemType itemType() { return catalogItemType; }
    UUID versionId() { return catalogItemVersionId; } UUID servingOptionId() { return servingOptionId; }
    BigDecimal quantity() { return quantity; } String quantityUnit() { return quantityUnit; }
    BigDecimal equivalentBasisQuantity() { return equivalentBasisQuantity; }
    BigDecimal basisQuantity() { return basisQuantity; } String baseUnit() { return baseUnit; }
    BigDecimal conversionFactor() { return conversionFactor; } String name() { return snapshotName; }
    BigDecimal kcal() { return kcal; } BigDecimal proteinG() { return proteinG; } BigDecimal carbohydrateG() { return carbohydrateG; }
    BigDecimal fatG() { return fatG; } BigDecimal fiberG() { return fiberG; } BigDecimal sodiumMg() { return sodiumMg; }
    DataQuality dataQuality() { return dataQuality; } BigDecimal uncertaintyKcal() { return uncertaintyKcal; }
}

record MealItemSnapshot(CatalogItemType itemType, UUID versionId, UUID servingOptionId, BigDecimal quantity,
        String quantityUnit, BigDecimal equivalentBasisQuantity, BigDecimal basisQuantity, String baseUnit,
        BigDecimal conversionFactor, String name,
        BigDecimal kcal, BigDecimal proteinG, BigDecimal carbohydrateG, BigDecimal fatG, BigDecimal fiberG,
        BigDecimal sodiumMg) {}

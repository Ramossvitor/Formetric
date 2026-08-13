package dev.formetric.catalog;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "food_items")
class FoodItem {

    @Id
    private UUID id;

    @Column(name = "owner_user_id")
    private UUID ownerUserId;

    @Enumerated(EnumType.STRING)
    private FoodOrigin origin;

    @Column(name = "external_source", length = 80)
    private String externalSource;

    @Column(name = "external_id", length = 160)
    private String externalId;

    private boolean archived;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "food", cascade = CascadeType.ALL, orphanRemoval = false, fetch = FetchType.LAZY)
    @OrderBy("versionNumber DESC")
    private List<FoodVersion> versions = new ArrayList<>();

    protected FoodItem() {
    }

    FoodItem(UUID ownerUserId, FoodOrigin origin, String externalSource, String externalId, Instant now) {
        this.id = UUID.randomUUID();
        this.ownerUserId = ownerUserId;
        this.origin = origin;
        this.externalSource = externalSource;
        this.externalId = externalId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    void addVersion(FoodVersion version, Instant now) {
        versions.add(version);
        updatedAt = now;
    }

    void setArchived(boolean archived, Instant now) {
        this.archived = archived;
        this.updatedAt = now;
    }

    UUID id() { return id; }
    UUID ownerUserId() { return ownerUserId; }
    FoodOrigin origin() { return origin; }
    String externalSource() { return externalSource; }
    String externalId() { return externalId; }
    boolean archived() { return archived; }
    Instant createdAt() { return createdAt; }
    Instant updatedAt() { return updatedAt; }
    List<FoodVersion> versions() { return versions.stream().sorted(Comparator.comparingInt(FoodVersion::versionNumber).reversed()).toList(); }
    FoodVersion currentVersion() { return versions().getFirst(); }
    int nextVersionNumber() { return versions.stream().mapToInt(FoodVersion::versionNumber).max().orElse(0) + 1; }
}

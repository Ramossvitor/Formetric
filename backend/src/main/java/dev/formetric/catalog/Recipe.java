package dev.formetric.catalog;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "recipes")
class Recipe {
    @Id private UUID id;
    @Column(name = "owner_user_id", nullable = false) private UUID ownerUserId;
    private boolean archived;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = false, fetch = FetchType.LAZY)
    @OrderBy("versionNumber DESC")
    private List<RecipeVersion> versions = new ArrayList<>();

    protected Recipe() {}

    Recipe(UUID ownerUserId, Instant now) {
        this.id = UUID.randomUUID();
        this.ownerUserId = ownerUserId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    void addVersion(RecipeVersion version, Instant now) { versions.add(version); updatedAt = now; }
    void setArchived(boolean archived, Instant now) { this.archived = archived; updatedAt = now; }
    UUID id() { return id; }
    UUID ownerUserId() { return ownerUserId; }
    boolean archived() { return archived; }
    Instant createdAt() { return createdAt; }
    Instant updatedAt() { return updatedAt; }
    List<RecipeVersion> versions() { return versions.stream().sorted(Comparator.comparingInt(RecipeVersion::versionNumber).reversed()).toList(); }
    RecipeVersion currentVersion() { return versions().getFirst(); }
    int nextVersionNumber() { return versions.stream().mapToInt(RecipeVersion::versionNumber).max().orElse(0) + 1; }
}

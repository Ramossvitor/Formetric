package dev.formetric.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "recipe_favorites")
@IdClass(RecipeFavorite.Key.class)
class RecipeFavorite {
    @Id @Column(name = "user_id") private UUID userId;
    @Id @Column(name = "recipe_id") private UUID recipeId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected RecipeFavorite() {}
    RecipeFavorite(UUID userId, UUID recipeId, Instant createdAt) {
        this.userId = userId; this.recipeId = recipeId; this.createdAt = createdAt;
    }
    record Key(UUID userId, UUID recipeId) implements Serializable {}
}

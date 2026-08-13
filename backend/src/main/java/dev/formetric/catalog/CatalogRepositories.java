package dev.formetric.catalog;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface FoodItemRepository extends JpaRepository<FoodItem, UUID> {

    @Query("select f from FoodItem f where f.id = :id and (f.ownerUserId = :userId or f.ownerUserId is null)")
    Optional<FoodItem> findVisibleById(@Param("id") UUID id, @Param("userId") UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from FoodItem f where f.id = :id and f.ownerUserId = :userId")
    Optional<FoodItem> findOwnedByIdForUpdate(@Param("id") UUID id, @Param("userId") UUID userId);

    @Query(value = """
            SELECT f.* FROM food_items f
            JOIN food_versions v ON v.food_id = f.id
              AND v.version_number = (SELECT max(v2.version_number) FROM food_versions v2 WHERE v2.food_id = f.id)
            LEFT JOIN food_favorites fav ON fav.food_id = f.id AND fav.user_id = :userId
            WHERE (f.owner_user_id = :userId OR f.owner_user_id IS NULL)
              AND (:includeArchived OR NOT f.archived)
              AND (NOT :favoriteOnly OR fav.food_id IS NOT NULL)
              AND (NOT :hasQuery
                OR formetric_normalize(v.name || ' ' || coalesce(v.brand, ''))
                    LIKE '%' || formetric_normalize(cast(:query AS text)) || '%'
                OR similarity(
                    formetric_normalize(v.name || ' ' || coalesce(v.brand, '')),
                    formetric_normalize(cast(:query AS text))) >= 0.2)
            ORDER BY (fav.food_id IS NOT NULL) DESC,
              CASE WHEN :hasQuery THEN similarity(
                formetric_normalize(v.name || ' ' || coalesce(v.brand, '')),
                formetric_normalize(cast(:query AS text))) ELSE 0 END DESC,
              v.name ASC, f.id ASC
            """,
            countQuery = """
            SELECT count(*) FROM food_items f
            JOIN food_versions v ON v.food_id = f.id
              AND v.version_number = (SELECT max(v2.version_number) FROM food_versions v2 WHERE v2.food_id = f.id)
            LEFT JOIN food_favorites fav ON fav.food_id = f.id AND fav.user_id = :userId
            WHERE (f.owner_user_id = :userId OR f.owner_user_id IS NULL)
              AND (:includeArchived OR NOT f.archived)
              AND (NOT :favoriteOnly OR fav.food_id IS NOT NULL)
              AND (NOT :hasQuery
                OR formetric_normalize(v.name || ' ' || coalesce(v.brand, ''))
                    LIKE '%' || formetric_normalize(cast(:query AS text)) || '%'
                OR similarity(
                    formetric_normalize(v.name || ' ' || coalesce(v.brand, '')),
                    formetric_normalize(cast(:query AS text))) >= 0.2)
            """, nativeQuery = true)
    Page<FoodItem> search(
            @Param("userId") UUID userId,
            @Param("query") String query,
            @Param("hasQuery") boolean hasQuery,
            @Param("favoriteOnly") boolean favoriteOnly,
            @Param("includeArchived") boolean includeArchived,
            Pageable pageable);
}

interface FoodVersionRepository extends JpaRepository<FoodVersion, UUID> {
    @Query("""
            select distinct version from FoodVersion version
            join fetch version.food food
            left join fetch version.servings
            where version.id = :id and (food.ownerUserId = :userId or food.ownerUserId is null)
            """)
    Optional<FoodVersion> findVisibleById(@Param("id") UUID id, @Param("userId") UUID userId);
}

interface FoodFavoriteRepository extends JpaRepository<FoodFavorite, FoodFavorite.Key> {
    boolean existsByUserIdAndFoodId(UUID userId, UUID foodId);
    void deleteByUserIdAndFoodId(UUID userId, UUID foodId);

    @Query("select favorite.foodId from FoodFavorite favorite where favorite.userId = :userId and favorite.foodId in :ids")
    List<UUID> findFavoriteIds(@Param("userId") UUID userId, @Param("ids") Collection<UUID> ids);
}

interface RecipeRepository extends JpaRepository<Recipe, UUID> {
    Optional<Recipe> findByIdAndOwnerUserId(UUID id, UUID ownerUserId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select recipe from Recipe recipe where recipe.id = :id and recipe.ownerUserId = :userId")
    Optional<Recipe> findOwnedByIdForUpdate(@Param("id") UUID id, @Param("userId") UUID userId);

    @Query(value = """
            SELECT r.* FROM recipes r
            JOIN recipe_versions v ON v.recipe_id = r.id
              AND v.version_number = (SELECT max(v2.version_number) FROM recipe_versions v2 WHERE v2.recipe_id = r.id)
            LEFT JOIN recipe_favorites fav ON fav.recipe_id = r.id AND fav.user_id = :userId
            WHERE r.owner_user_id = :userId
              AND (:includeArchived OR NOT r.archived)
              AND (NOT :favoriteOnly OR fav.recipe_id IS NOT NULL)
              AND (NOT :hasQuery
                OR formetric_normalize(v.name) LIKE '%' || formetric_normalize(cast(:query AS text)) || '%'
                OR similarity(formetric_normalize(v.name), formetric_normalize(cast(:query AS text))) >= 0.2)
            ORDER BY (fav.recipe_id IS NOT NULL) DESC,
              CASE WHEN :hasQuery THEN similarity(
                formetric_normalize(v.name), formetric_normalize(cast(:query AS text))) ELSE 0 END DESC,
              v.name ASC, r.id ASC
            """,
            countQuery = """
            SELECT count(*) FROM recipes r
            JOIN recipe_versions v ON v.recipe_id = r.id
              AND v.version_number = (SELECT max(v2.version_number) FROM recipe_versions v2 WHERE v2.recipe_id = r.id)
            LEFT JOIN recipe_favorites fav ON fav.recipe_id = r.id AND fav.user_id = :userId
            WHERE r.owner_user_id = :userId
              AND (:includeArchived OR NOT r.archived)
              AND (NOT :favoriteOnly OR fav.recipe_id IS NOT NULL)
              AND (NOT :hasQuery
                OR formetric_normalize(v.name) LIKE '%' || formetric_normalize(cast(:query AS text)) || '%'
                OR similarity(formetric_normalize(v.name), formetric_normalize(cast(:query AS text))) >= 0.2)
            """, nativeQuery = true)
    Page<Recipe> search(
            @Param("userId") UUID userId,
            @Param("query") String query,
            @Param("hasQuery") boolean hasQuery,
            @Param("favoriteOnly") boolean favoriteOnly,
            @Param("includeArchived") boolean includeArchived,
            Pageable pageable);
}

interface RecipeVersionRepository extends JpaRepository<RecipeVersion, UUID> {
    @Query("""
            select distinct version from RecipeVersion version
            join fetch version.recipe recipe
            left join fetch version.ingredients ingredient
            left join fetch ingredient.foodVersion
            where version.id = :id and recipe.ownerUserId = :userId
            """)
    Optional<RecipeVersion> findVisibleById(@Param("id") UUID id, @Param("userId") UUID userId);
}

interface RecipeFavoriteRepository extends JpaRepository<RecipeFavorite, RecipeFavorite.Key> {
    boolean existsByUserIdAndRecipeId(UUID userId, UUID recipeId);
    void deleteByUserIdAndRecipeId(UUID userId, UUID recipeId);

    @Query("select favorite.recipeId from RecipeFavorite favorite where favorite.userId = :userId and favorite.recipeId in :ids")
    List<UUID> findFavoriteIds(@Param("userId") UUID userId, @Param("ids") Collection<UUID> ids);
}

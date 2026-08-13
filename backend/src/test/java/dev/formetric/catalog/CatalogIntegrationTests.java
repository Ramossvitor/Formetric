package dev.formetric.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import dev.formetric.identity.AuthenticatedUser;
import dev.formetric.identity.CurrentUserProvider;
import dev.formetric.identity.UserRole;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@Testcontainers
class CatalogIntegrationTests {

    private static final UUID USER_ONE = UUID.fromString("31000000-0000-0000-0000-000000000001");
    private static final UUID USER_TWO = UUID.fromString("32000000-0000-0000-0000-000000000002");
    private static final Instant NOW = Instant.parse("2026-08-12T12:00:00Z");

    @Container
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired CatalogService service;
    @Autowired CatalogNutritionProvider nutritionProvider;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CurrentUserProvider currentUserProvider;
    @MockitoBean Clock clock;

    @BeforeEach
    void prepareDatabase() {
        jdbc.execute("""
                TRUNCATE TABLE recipe_favorites, recipe_ingredients, recipe_versions, recipes,
                    food_favorites, food_serving_options, food_versions, food_items,
                    user_invites, user_profiles, user_accounts CASCADE
                """);
        createUser(USER_ONE, "catalog-one@example.test");
        createUser(USER_TWO, "catalog-two@example.test");
        when(clock.instant()).thenReturn(NOW);
        authenticate(USER_ONE);
    }

    @Test
    void editingFoodAppendsVersionAndOldVersionKeepsHistoricalCalculation() {
        FoodView created = service.createFood(
                FoodOrigin.USER, null, null,
                foodDefinition("Whey Protein", "Bodybuilders", "112", "27", List.of(
                        serving("Medidor", CatalogUnit.UNIT, "1", "30"))));
        UUID originalVersionId = created.food().currentVersion().id();

        FoodView edited = service.addFoodVersion(created.food().id(),
                foodDefinition("Whey Protein", "Bodybuilders", "120", "28", List.of(
                        serving("Medidor", CatalogUnit.UNIT, "1", "30"))));

        assertEquals(2, edited.food().versions().size());
        assertEquals(2, edited.food().currentVersion().versionNumber());
        CatalogNutritionSnapshot historical = nutritionProvider.resolve(
                CatalogItemType.FOOD, originalVersionId, decimal("42"), CatalogUnit.G, null);
        assertEquals(decimal("47.040"), historical.nutrients().caloriesKcal());
        assertEquals(decimal("11.340"), historical.nutrients().proteinG());
    }

    @Test
    void resolvesVersionedServingAndRejectsServingFromAnotherVersion() {
        FoodView food = service.createFood(FoodOrigin.USER, null, null,
                foodDefinition("Pão francês", null, "135", "4.5", List.of(
                        serving("Fatia", CatalogUnit.SLICE, "1", "25"))));
        FoodVersion version = food.food().currentVersion();
        UUID servingId = version.servings().getFirst().id();

        CatalogNutritionSnapshot twoSlices = nutritionProvider.resolve(
                CatalogItemType.FOOD, version.id(), decimal("2"), CatalogUnit.SLICE, servingId);

        assertEquals(decimal("50.000"), twoSlices.equivalentBasisQuantity());
        assertEquals(decimal("67.500"), twoSlices.nutrients().caloriesKcal());
        assertEquals(CatalogUnit.G, twoSlices.basisUnit());

        FoodView other = service.createFood(FoodOrigin.USER, null, null,
                foodDefinition("Queijo", null, "100", "8", List.of(
                        serving("Fatia", CatalogUnit.SLICE, "1", "20"))));
        assertThrows(CatalogNutritionResolutionException.class, () -> nutritionProvider.resolve(
                CatalogItemType.FOOD, other.food().currentVersion().id(), decimal("1"),
                CatalogUnit.SLICE, servingId));
    }

    @Test
    void tolerantSearchHandlesAccentsAndBrandWhileKeepingPrivateItemsIsolated() {
        service.createFood(FoodOrigin.USER, null, null,
                foodDefinition("Pão francês", "Padaria Central", "140", "5", List.of()));
        service.createFood(FoodOrigin.USER, null, null,
                foodDefinition("Whey Protein", "Bodybuilders", "112", "27", List.of()));

        authenticate(USER_TWO);
        FoodView privateFood = service.createFood(FoodOrigin.USER, null, null,
                foodDefinition("Banana secreta", null, "90", "1", List.of()));
        authenticate(USER_ONE);

        assertEquals("Pão francês", service.listFoods("pao frances", false, false, 0, 20)
                .content().getFirst().food().currentVersion().name());
        assertEquals("Whey Protein", service.listFoods("whey bodybuilder", false, false, 0, 20)
                .content().getFirst().food().currentVersion().name());
        assertTrue(service.listFoods("banana secreta", false, false, 0, 20).content().isEmpty());
        assertThrows(CatalogNutritionResolutionException.class, () -> nutritionProvider.resolve(
                CatalogItemType.FOOD, privateFood.food().currentVersion().id(), decimal("100"), CatalogUnit.G, null));
        assertThrows(CatalogValidationException.class,
                () -> service.listFoods("   ", false, false, 0, 20));
    }

    @Test
    void globalFoodIsVisibleButFavoritesStayPerUserAndGlobalMutationIsForbidden() {
        GlobalFood global = createGlobalFood("Arroz integral");

        FoodView userOneView = service.getFood(global.foodId());
        assertEquals(FoodOrigin.SYSTEM, userOneView.food().origin());
        assertFalse(userOneView.favorite());
        service.favoriteFood(global.foodId(), true);
        assertTrue(service.getFood(global.foodId()).favorite());
        assertThrows(CatalogNotFoundException.class, () -> service.archiveFood(global.foodId(), true));

        authenticate(USER_TWO);
        assertFalse(service.getFood(global.foodId()).favorite());
        assertEquals(decimal("124.000"), nutritionProvider.resolve(
                CatalogItemType.FOOD, global.versionId(), decimal("100"), CatalogUnit.G, null)
                .nutrients().caloriesKcal());
        service.favoriteFood(global.foodId(), true);

        authenticate(USER_ONE);
        service.favoriteFood(global.foodId(), false);
        assertFalse(service.getFood(global.foodId()).favorite());
        authenticate(USER_TWO);
        assertTrue(service.getFood(global.foodId()).favorite());
    }

    @Test
    void recipeCalculatesTotalsPer100gAndServingThenDuplicatesWithoutCycles() {
        FoodView bread = service.createFood(FoodOrigin.USER, null, null,
                foodDefinition("Pão de forma", null, "250", "10", List.of(
                        serving("Fatia", CatalogUnit.SLICE, "1", "30"))));
        FoodVersion breadVersion = bread.food().currentVersion();
        UUID sliceId = breadVersion.servings().getFirst().id();

        RecipeView created = service.createRecipe(new RecipeVersionDefinition(
                "Sanduíche simples", "Receita de teste", decimal("60"), CatalogUnit.G, decimal("30"),
                List.of(new RecipeIngredientDefinition(
                        breadVersion.id(), decimal("2"), CatalogUnit.SLICE, sliceId, null))));
        RecipeNutrition nutrition = CatalogCalculations.calculate(created.recipe().currentVersion());

        assertEquals(decimal("150.000"), nutrition.total().caloriesKcal());
        assertEquals(decimal("250.000"), nutrition.per100g().caloriesKcal());
        assertEquals(decimal("75.000"), nutrition.perServing().caloriesKcal());

        CatalogNutritionSnapshot onePortion = nutritionProvider.resolve(
                CatalogItemType.RECIPE, created.recipe().currentVersion().id(),
                decimal("1"), CatalogUnit.PORTION, null);
        assertEquals(decimal("30.000"), onePortion.equivalentBasisQuantity());
        assertEquals(decimal("75.000"), onePortion.nutrients().caloriesKcal());

        RecipeView duplicated = service.duplicateRecipe(created.recipe().id());
        assertNotEquals(created.recipe().id(), duplicated.recipe().id());
        assertEquals(1, duplicated.recipe().currentVersion().versionNumber());
        assertTrue(duplicated.recipe().currentVersion().name().endsWith("(cópia)"));
    }

    @Test
    void archiveAndFavoriteDoNotDeleteCatalogHistory() {
        FoodView food = service.createFood(FoodOrigin.USER, null, null,
                foodDefinition("Aveia", null, "380", "13", List.of()));
        UUID id = food.food().id();
        UUID versionId = food.food().currentVersion().id();

        service.favoriteFood(id, true);
        assertEquals(1, service.listFoods(null, true, false, 0, 20).totalElements());
        service.archiveFood(id, true);
        assertEquals(0, service.listFoods(null, false, false, 0, 20).totalElements());
        assertEquals(1, service.listFoods(null, false, true, 0, 20).totalElements());
        assertEquals(decimal("380.000"), nutritionProvider.resolve(
                CatalogItemType.FOOD, versionId, decimal("100"), CatalogUnit.G, null)
                .nutrients().caloriesKcal());
        service.archiveFood(id, false);
        assertFalse(service.getFood(id).food().archived());
    }

    @Test
    void databaseEnforcesOwnershipNutrientsAndAccountDeletionCascade() {
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("""
                INSERT INTO food_items
                    (id, owner_user_id, origin, archived, created_at, updated_at)
                VALUES (?, NULL, 'USER', false, now(), now())
                """, UUID.randomUUID()));

        FoodView food = service.createFood(FoodOrigin.USER, null, null,
                foodDefinition("Patinho", null, "150", "25", List.of()));
        service.createRecipe(new RecipeVersionDefinition(
                "Patinho preparado", null, decimal("100"), CatalogUnit.G, null,
                List.of(new RecipeIngredientDefinition(
                        food.food().currentVersion().id(), decimal("100"), CatalogUnit.G, null, null))));

        jdbc.update("DELETE FROM user_accounts WHERE id = ?", USER_ONE);

        assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM food_items WHERE owner_user_id = ?", Integer.class, USER_ONE));
        assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM recipes WHERE owner_user_id = ?", Integer.class, USER_ONE));
    }

    private FoodVersionDefinition foodDefinition(
            String name, String brand, String kcal, String protein, List<ServingDefinition> servings) {
        return new FoodVersionDefinition(name, brand, null, decimal("100"), CatalogUnit.G,
                decimal(kcal), decimal(protein), decimal("10"), decimal("2"), decimal("1"),
                null, NutritionQuality.EXACT, null, servings);
    }

    private ServingDefinition serving(String label, CatalogUnit unit, String quantity, String equivalent) {
        return new ServingDefinition(label, unit, decimal(quantity), decimal(equivalent));
    }

    private GlobalFood createGlobalFood(String name) {
        UUID foodId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO food_items (id, owner_user_id, origin, archived, created_at, updated_at)
                VALUES (?, NULL, 'SYSTEM', false, ?, ?)
                """, foodId, sqlTime(), sqlTime());
        jdbc.update("""
                INSERT INTO food_versions (
                    id, food_id, version_number, name, reference_quantity, reference_unit,
                    calories_kcal, protein_g, carbohydrate_g, fat_g, fiber_g,
                    nutrition_quality, created_at)
                VALUES (?, ?, 1, ?, 100, 'G', 124, 2.6, 25.8, 1, 2.7, 'EXACT', ?)
                """, versionId, foodId, name, sqlTime());
        return new GlobalFood(foodId, versionId);
    }

    private void createUser(UUID id, String email) {
        jdbc.update("""
                INSERT INTO user_accounts
                    (id, email, password_hash, role, status, created_at, updated_at)
                VALUES (?, ?, 'test-only', 'USER', 'ACTIVE', ?, ?)
                """, id, email, sqlTime(), sqlTime());
    }

    private void authenticate(UUID id) {
        when(currentUserProvider.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(id, id + "@example.test", "Catalog Test", UserRole.USER));
    }

    private BigDecimal decimal(String value) { return new BigDecimal(value); }
    private OffsetDateTime sqlTime() { return NOW.atOffset(ZoneOffset.UTC); }
    private record GlobalFood(UUID foodId, UUID versionId) {}
}

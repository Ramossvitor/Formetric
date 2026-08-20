package dev.formetric.planning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class PlanningMigrationTests {

    @Container
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @Test
    void v8PreservesLegacyGoalsAndOnlyExpandsCanonicalTargetTypes() throws Exception {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .target(MigrationVersion.fromVersion("7"))
                .load()
                .migrate();

        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO user_accounts
                        (id, email, password_hash, role, status, created_at, updated_at)
                    VALUES
                        ('10000000-0000-0000-0000-000000000008', 'legacy@example.test',
                         'test-only', 'USER', 'ACTIVE', now(), now())
                    """);
            statement.executeUpdate("""
                    INSERT INTO nutrition_goal_periods
                        (id, user_id, valid_from, valid_to, calorie_target, created_at, updated_at)
                    VALUES
                        ('20000000-0000-0000-0000-000000000008',
                         '10000000-0000-0000-0000-000000000008',
                         DATE '2026-01-01', NULL, 2500, now(), now())
                    """);
            statement.executeUpdate("""
                    INSERT INTO nutrient_targets (id, goal_period_id, nutrient, unit)
                    VALUES
                        ('30000000-0000-0000-0000-000000000008',
                         '20000000-0000-0000-0000-000000000008', 'PROTEIN', 'G')
                    """);
            statement.executeUpdate("""
                    INSERT INTO goal_bands
                        (id, nutrient_target_id, band_order, min_value, max_value,
                         min_inclusive, max_inclusive, label, tone, counts_as_attained)
                    VALUES
                        ('40000000-0000-0000-0000-000000000008',
                         '30000000-0000-0000-0000-000000000008',
                         0, 175, NULL, true, false, 'Meta', 'POSITIVE', true)
                    """);
        }

        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .load()
                .migrate();

        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            assertThat(singleInt(statement, "SELECT count(*) FROM nutrient_targets")).isEqualTo(1);
            assertThat(singleInt(statement, "SELECT count(*) FROM nutrient_targets WHERE nutrient = 'CALORIES'"))
                    .isZero();
            assertThat(singleInt(statement, "SELECT count(*) FROM goal_bands")).isEqualTo(1);

            statement.executeUpdate("""
                    INSERT INTO nutrient_targets (id, goal_period_id, nutrient, unit)
                    VALUES
                        ('50000000-0000-0000-0000-000000000008',
                         '20000000-0000-0000-0000-000000000008', 'CALORIES', 'KCAL')
                    """);

            assertThatThrownBy(() -> statement.executeUpdate("""
                    INSERT INTO nutrient_targets (id, goal_period_id, nutrient, unit)
                    VALUES
                        ('60000000-0000-0000-0000-000000000008',
                         '20000000-0000-0000-0000-000000000008', 'FAT', 'ML')
                    """))
                    .isInstanceOf(SQLException.class)
                    .extracting(error -> ((SQLException) error).getSQLState())
                    .isEqualTo("23514");
        }
    }

    private static Connection connection() throws SQLException {
        return DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private static int singleInt(Statement statement, String sql) throws SQLException {
        try (var result = statement.executeQuery(sql)) {
            result.next();
            return result.getInt(1);
        }
    }
}

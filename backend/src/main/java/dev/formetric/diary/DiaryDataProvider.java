package dev.formetric.diary;

import dev.formetric.identity.CurrentUserProvider;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only, user-scoped diary snapshots for deterministic analytics.
 *
 * <p>Food and water are aggregated independently before they are joined to a daily log. This is
 * intentional: joining meal items and water events in one aggregate would multiply both totals.
 */
@Component
public class DiaryDataProvider {

    private static final String TIMELINE_SQL = """
            WITH scoped_logs AS (
                SELECT id, log_date, status
                FROM daily_logs
                WHERE user_id = :userId
                  AND log_date BETWEEN :from AND :to
            ), item_totals AS (
                SELECT meal.daily_log_id,
                       count(item.id) AS item_count,
                       sum(item.snapshot_kcal) AS kcal,
                       sum(item.snapshot_protein_g) AS protein_g,
                       sum(item.snapshot_carbohydrate_g) AS carbohydrate_g,
                       sum(item.snapshot_fat_g) AS fat_g,
                       sum(item.snapshot_fiber_g) AS fiber_g
                FROM meals meal
                JOIN scoped_logs scoped ON scoped.id = meal.daily_log_id
                JOIN meal_items item ON item.meal_id = meal.id
                GROUP BY meal.daily_log_id
            ), water_totals AS (
                SELECT water.daily_log_id,
                       count(water.id) AS water_entry_count,
                       sum(water.volume_ml) AS water_ml
                FROM water_logs water
                JOIN scoped_logs scoped ON scoped.id = water.daily_log_id
                GROUP BY water.daily_log_id
            )
            SELECT scoped.log_date,
                   scoped.status,
                   coalesce(items.item_count, 0) AS item_count,
                   items.kcal,
                   items.protein_g,
                   items.carbohydrate_g,
                   items.fat_g,
                   items.fiber_g,
                   coalesce(water.water_entry_count, 0) AS water_entry_count,
                   water.water_ml,
                   coalesce(closure.fasting_confirmed, false) AS fasting_confirmed
            FROM scoped_logs scoped
            LEFT JOIN item_totals items ON items.daily_log_id = scoped.id
            LEFT JOIN water_totals water ON water.daily_log_id = scoped.id
            LEFT JOIN LATERAL (
                SELECT event.fasting_confirmed
                FROM daily_log_state_events event
                WHERE event.daily_log_id = scoped.id
                  AND event.event_type = 'CLOSED'
                ORDER BY event.event_order DESC
                LIMIT 1
            ) closure ON true
            ORDER BY scoped.log_date
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final CurrentUserProvider currentUserProvider;

    public DiaryDataProvider(
            NamedParameterJdbcTemplate jdbcTemplate,
            CurrentUserProvider currentUserProvider) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public Optional<DiaryDayData> day(LocalDate date) {
        requireDate(date, "date");
        List<DiaryDayData> result = timeline(date, date);
        return result.stream().findFirst();
    }

    @Transactional(readOnly = true)
    public List<DiaryDayData> timeline(LocalDate from, LocalDate to) {
        requireDate(from, "from");
        requireDate(to, "to");
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("from must not be after to");
        }
        UUID userId = currentUserProvider.requireCurrentUser().id();
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("from", Date.valueOf(from))
                .addValue("to", Date.valueOf(to));
        return jdbcTemplate.query(TIMELINE_SQL, parameters, (resultSet, rowNumber) -> {
            DailyLogStatus status = DailyLogStatus.valueOf(resultSet.getString("status"));
            return new DiaryDayData(
                    resultSet.getObject("log_date", LocalDate.class),
                    status,
                    status == DailyLogStatus.CLOSED && resultSet.getBoolean("fasting_confirmed"),
                    resultSet.getInt("item_count"),
                    resultSet.getBigDecimal("kcal"),
                    resultSet.getBigDecimal("protein_g"),
                    resultSet.getBigDecimal("carbohydrate_g"),
                    resultSet.getBigDecimal("fat_g"),
                    resultSet.getBigDecimal("fiber_g"),
                    resultSet.getInt("water_entry_count"),
                    resultSet.getBigDecimal("water_ml"));
        });
    }

    private static void requireDate(LocalDate date, String name) {
        if (date == null) {
            throw new IllegalArgumentException(name + " is required");
        }
    }

    public record DiaryDayData(
            LocalDate date,
            DailyLogStatus status,
            boolean fastingConfirmed,
            int foodItemCount,
            BigDecimal caloriesKcal,
            BigDecimal proteinG,
            BigDecimal carbohydrateG,
            BigDecimal fatG,
            BigDecimal fiberG,
            int waterEntryCount,
            BigDecimal waterMl) {
    }
}

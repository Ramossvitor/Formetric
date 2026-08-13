package dev.formetric.activity;

import dev.formetric.identity.CurrentUserProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Read-only, user-scoped activity data for deterministic analytics. */
@Component
public class ActivityDataProvider {

    private final WorkoutRepository workouts;
    private final WeightLogRepository weightLogs;
    private final CurrentUserProvider currentUserProvider;

    ActivityDataProvider(
            WorkoutRepository workouts,
            WeightLogRepository weightLogs,
            CurrentUserProvider currentUserProvider) {
        this.workouts = workouts;
        this.weightLogs = weightLogs;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public List<WorkoutData> workouts(LocalDate from, LocalDate to) {
        ActivityRangeRules.validate(from, to);
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return workouts.findAllByUserIdAndDateBetweenOrderByDateAscStartTimeAscIdAsc(userId, from, to).stream()
                .map(workout -> new WorkoutData(
                        workout.id(),
                        workout.date(),
                        workout.modality(),
                        workout.customModality(),
                        workout.title(),
                        workout.muscleGroups(),
                        workout.durationMinutes(),
                        workout.estimatedKcal()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<WeightData> weights(LocalDate from, LocalDate to) {
        ActivityRangeRules.validate(from, to);
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return weightLogs.findAllByUserIdAndDateBetweenOrderByDateAscMeasuredAtAsc(userId, from, to).stream()
                .map(log -> new WeightData(log.date(), log.weightKg()))
                .toList();
    }

    public record WorkoutData(
            UUID id,
            LocalDate date,
            WorkoutModality modality,
            String customModality,
            String title,
            List<String> muscleGroups,
            int durationMinutes,
            BigDecimal estimatedKcal) {
    }

    public record WeightData(LocalDate date, BigDecimal weightKg) {
    }
}

package dev.formetric.activity;

import dev.formetric.identity.CurrentUserProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
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

    @Transactional(readOnly = true)
    public Optional<DateBounds> bounds() {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        List<LocalDate> earliestCandidates = java.util.stream.Stream.of(
                        workouts.findFirstByUserIdOrderByDateAsc(userId).map(Workout::date),
                        weightLogs.findFirstByUserIdOrderByDateAsc(userId).map(WeightLog::date))
                .flatMap(Optional::stream)
                .toList();
        List<LocalDate> latestCandidates = java.util.stream.Stream.of(
                        workouts.findFirstByUserIdOrderByDateDesc(userId).map(Workout::date),
                        weightLogs.findFirstByUserIdOrderByDateDesc(userId).map(WeightLog::date))
                .flatMap(Optional::stream)
                .toList();
        if (earliestCandidates.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new DateBounds(
                earliestCandidates.stream().min(LocalDate::compareTo).orElseThrow(),
                latestCandidates.stream().max(LocalDate::compareTo).orElseThrow()));
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

    public record DateBounds(LocalDate earliestDate, LocalDate latestDate) {
    }
}

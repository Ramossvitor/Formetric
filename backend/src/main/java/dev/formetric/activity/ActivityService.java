package dev.formetric.activity;

import dev.formetric.identity.CurrentUserProvider;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ActivityService {

    private final WorkoutRepository workouts;
    private final WeightLogRepository weightLogs;
    private final WorkoutIdempotencyRepository idempotencyKeys;
    private final CurrentUserProvider currentUserProvider;
    private final JdbcTemplate jdbcTemplate;
    private final Clock clock;

    ActivityService(
            WorkoutRepository workouts,
            WeightLogRepository weightLogs,
            WorkoutIdempotencyRepository idempotencyKeys,
            CurrentUserProvider currentUserProvider,
            JdbcTemplate jdbcTemplate,
            Clock clock) {
        this.workouts = workouts;
        this.weightLogs = weightLogs;
        this.idempotencyKeys = idempotencyKeys;
        this.currentUserProvider = currentUserProvider;
        this.jdbcTemplate = jdbcTemplate;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    List<WorkoutResponse> listWorkouts(LocalDate from, LocalDate to) {
        ActivityRangeRules.validate(from, to);
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return workouts.findAllByUserIdAndDateBetweenOrderByDateAscStartTimeAscIdAsc(userId, from, to).stream()
                .map(WorkoutResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    WorkoutResponse getWorkout(UUID workoutId) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return WorkoutResponse.from(requireWorkout(userId, workoutId));
    }

    @Transactional
    WorkoutResponse createWorkout(CreateWorkoutRequest request) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        WorkoutDetails details = request.toDetails();
        WorkoutRules.validate(details);
        String fingerprint = workoutFingerprint(details);

        if (request.requestId() != null) {
            acquireAdvisoryLock(userId + ":workout-request:" + request.requestId());
            var existing = idempotencyKeys.findById(new WorkoutIdempotencyId(userId, request.requestId()));
            if (existing.isPresent()) {
                WorkoutIdempotencyKey key = existing.get();
                if (!fingerprint.equals(key.payloadFingerprint())) {
                    throw new ActivityConflictException("O requestId já foi utilizado com outro payload.");
                }
                if (key.resourceId() == null) {
                    throw new ActivityConflictException("O treino criado por este requestId já foi removido.");
                }
                return WorkoutResponse.from(requireWorkout(userId, key.resourceId()));
            }
        }

        Workout workout = Workout.create(userId, details, clock.instant());
        try {
            workouts.saveAndFlush(workout);
            if (request.requestId() != null) {
                idempotencyKeys.saveAndFlush(new WorkoutIdempotencyKey(
                        userId, request.requestId(), fingerprint, workout.id(), clock.instant()));
            }
            return WorkoutResponse.from(workout);
        } catch (DataIntegrityViolationException exception) {
            throw new ActivityConflictException(
                    "O treino conflita com outro registro ou requisição já processada.", exception);
        }
    }

    @Transactional
    WorkoutResponse updateWorkout(UUID workoutId, UpdateWorkoutRequest request) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        if (request.version() == null) {
            throw new ActivityValidationException("version", "A versão atual do treino é obrigatória.");
        }
        Workout workout = requireWorkout(userId, workoutId);
        workout.update(request.toDetails(), request.version(), clock.instant());
        try {
            return WorkoutResponse.from(workouts.saveAndFlush(workout));
        } catch (DataIntegrityViolationException exception) {
            throw new ActivityConflictException("Não foi possível atualizar o treino.", exception);
        }
    }

    @Transactional
    void deleteWorkout(UUID workoutId) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        Workout workout = requireWorkout(userId, workoutId);
        workouts.delete(workout);
        workouts.flush();
    }

    @Transactional(readOnly = true)
    List<WeightLogResponse> listWeightLogs(LocalDate from, LocalDate to) {
        ActivityRangeRules.validate(from, to);
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return findWeights(userId, from, to).stream().map(WeightLogResponse::from).toList();
    }

    @Transactional(readOnly = true)
    WeightLogResponse getWeightLog(LocalDate date) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return WeightLogResponse.from(requireWeight(userId, date));
    }

    @Transactional
    WeightLogResponse upsertWeightLog(LocalDate date, UpsertWeightLogRequest request) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        WeightDetails details = request.toDetails();
        WeightRules.validate(details);
        acquireAdvisoryLock(userId + ":weight-date:" + date);

        WeightLog weightLog = weightLogs.findByUserIdAndDate(userId, date).orElse(null);
        if (weightLog == null) {
            if (request.version() != null) {
                throw new ActivityConflictException(
                        "A pesagem não existe mais. Atualize o histórico antes de tentar novamente.");
            }
            weightLog = WeightLog.create(userId, date, details, clock.instant());
        } else {
            if (request.version() == null) {
                throw new ActivityConflictException(
                        "Informe a versão atual para alterar uma pesagem existente.");
            }
            weightLog.update(details, request.version(), clock.instant());
        }
        try {
            return WeightLogResponse.from(weightLogs.saveAndFlush(weightLog));
        } catch (DataIntegrityViolationException exception) {
            throw new ActivityConflictException("Já existe uma pesagem oficial nesta data.", exception);
        }
    }

    @Transactional
    void deleteWeightLog(LocalDate date) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        WeightLog weightLog = requireWeight(userId, date);
        weightLogs.delete(weightLog);
        weightLogs.flush();
    }

    @Transactional(readOnly = true)
    WeightOverviewResponse weightOverview(LocalDate from, LocalDate to) {
        ActivityRangeRules.validate(from, to);
        UUID userId = currentUserProvider.requireCurrentUser().id();
        List<WeightLog> entries = findWeights(userId, from, to);
        return WeightOverviewResponse.from(entries, WeightMetrics.calculate(entries));
    }

    private List<WeightLog> findWeights(UUID userId, LocalDate from, LocalDate to) {
        return weightLogs.findAllByUserIdAndDateBetweenOrderByDateAscMeasuredAtAsc(userId, from, to);
    }

    private Workout requireWorkout(UUID userId, UUID workoutId) {
        return workouts.findByIdAndUserId(workoutId, userId)
                .orElseThrow(() -> new ActivityNotFoundException("Treino não encontrado."));
    }

    private WeightLog requireWeight(UUID userId, LocalDate date) {
        return weightLogs.findByUserIdAndDate(userId, date)
                .orElseThrow(() -> new ActivityNotFoundException("Pesagem não encontrada nesta data."));
    }

    private void acquireAdvisoryLock(String key) {
        jdbcTemplate.queryForObject(
                "select pg_advisory_xact_lock(hashtextextended(?, 0)) is null",
                Boolean.class,
                key);
    }

    private static String workoutFingerprint(WorkoutDetails details) {
        List<String> groups = WorkoutRules.normalizeMuscleGroups(details.muscleGroups());
        return ActivityIdempotencyFingerprint.of(
                "CREATE_WORKOUT",
                details.date(),
                details.modality(),
                WorkoutRules.optionalTrimmed(details.customModality()),
                details.title().trim(),
                String.join("\u001f", groups),
                details.startTime(),
                details.durationMinutes(),
                details.estimatedKcal(),
                details.notes());
    }
}

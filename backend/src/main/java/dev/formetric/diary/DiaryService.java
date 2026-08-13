package dev.formetric.diary;

import dev.formetric.catalog.CatalogNutritionProvider;
import dev.formetric.catalog.CatalogNutritionResolutionException;
import dev.formetric.catalog.CatalogNutritionSnapshot;
import dev.formetric.identity.CurrentUserProvider;
import dev.formetric.planning.PlanningDataProvider;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class DiaryService {

    private final DailyLogRepository dailyLogs;
    private final DiaryIdempotencyRepository idempotencyKeys;
    private final CatalogNutritionProvider catalogNutritionProvider;
    private final PlanningDataProvider planningDataProvider;
    private final CurrentUserProvider currentUserProvider;
    private final Clock clock;
    private final JdbcTemplate jdbcTemplate;

    DiaryService(
            DailyLogRepository dailyLogs,
            DiaryIdempotencyRepository idempotencyKeys,
            CatalogNutritionProvider catalogNutritionProvider,
            PlanningDataProvider planningDataProvider,
            CurrentUserProvider currentUserProvider,
            Clock clock,
            JdbcTemplate jdbcTemplate) {
        this.dailyLogs = dailyLogs;
        this.idempotencyKeys = idempotencyKeys;
        this.catalogNutritionProvider = catalogNutritionProvider;
        this.planningDataProvider = planningDataProvider;
        this.currentUserProvider = currentUserProvider;
        this.clock = clock;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    DailyLogResponse get(LocalDate date) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return response(requireLog(userId, date));
    }

    @Transactional
    DailyLogResponse addMeal(LocalDate date, CreateMealRequest request) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return idempotent(userId, date, request.requestId(), "ADD_MEAL", () -> {
            DailyLog log = findOrCreate(userId, date);
            int position = request.position() == null ? log.nextMealPosition() : request.position();
            log.addMeal(request.name(), position, request.mealTime(), clock.instant());
            return log;
        });
    }

    @Transactional
    DailyLogResponse updateMeal(LocalDate date, UUID mealId, UpdateMealRequest request) {
        DailyLog log = requireOwnedForUpdate(date);
        log.mealById(mealId).update(request.name(), request.position(), request.mealTime(), clock.instant());
        return response(log);
    }

    @Transactional
    DailyLogResponse deleteMeal(LocalDate date, UUID mealId) {
        DailyLog log = requireOwnedForUpdate(date);
        log.removeMeal(log.mealById(mealId), clock.instant());
        return response(log);
    }

    @Transactional
    DailyLogResponse reorderMeals(LocalDate date, ReorderRequest request) {
        DailyLog log = requireOwnedForUpdate(date);
        log.reorderMeals(request.ids(), clock.instant());
        return response(log);
    }

    @Transactional
    DailyLogResponse addItem(LocalDate date, UUID mealId, UpsertMealItemRequest request) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return idempotent(userId, date, request.requestId(), "ADD_ITEM", () -> {
            DailyLog log = requireLogForUpdate(userId, date);
            Meal meal = log.mealById(mealId);
            ResolvedItem resolved = resolve(request);
            int position = request.position() == null ? meal.nextItemPosition() : request.position();
            DataQuality quality = request.dataQuality() == null
                    ? resolved.quality()
                    : request.dataQuality();
            BigDecimal uncertainty = request.uncertaintyKcal() == null
                    ? resolved.uncertainty()
                    : request.uncertaintyKcal();
            meal.addItem(resolved.snapshot(), position, quality, uncertainty, clock.instant());
            return log;
        });
    }

    @Transactional
    DailyLogResponse updateItem(LocalDate date, UUID mealId, UUID itemId, UpsertMealItemRequest request) {
        DailyLog log = requireOwnedForUpdate(date);
        Meal meal = log.mealById(mealId);
        MealItem item = meal.itemById(itemId);
        ResolvedItem resolved = resolve(request);
        int position = request.position() == null ? item.position() : request.position();
        DataQuality quality = request.dataQuality() == null ? resolved.quality() : request.dataQuality();
        BigDecimal uncertainty = request.uncertaintyKcal() == null ? resolved.uncertainty() : request.uncertaintyKcal();
        item.replace(resolved.snapshot(), position, quality, uncertainty, clock.instant());
        log.touch(clock.instant());
        return response(log);
    }

    @Transactional
    DailyLogResponse deleteItem(LocalDate date, UUID mealId, UUID itemId) {
        DailyLog log = requireOwnedForUpdate(date);
        Meal meal = log.mealById(mealId);
        meal.removeItem(meal.itemById(itemId), clock.instant());
        return response(log);
    }

    @Transactional
    DailyLogResponse reorderItems(LocalDate date, UUID mealId, ReorderRequest request) {
        DailyLog log = requireOwnedForUpdate(date);
        log.mealById(mealId).reorderItems(request.ids(), clock.instant());
        return response(log);
    }

    @Transactional
    DailyLogResponse addWater(LocalDate date, CreateWaterRequest request) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return idempotent(userId, date, request.requestId(), "ADD_WATER", () -> {
            DailyLog log = findOrCreate(userId, date);
            log.addWater(request.loggedAt(), request.volumeMl(), clock.instant());
            return log;
        });
    }

    @Transactional
    DailyLogResponse updateWater(LocalDate date, UUID waterId, UpdateWaterRequest request) {
        DailyLog log = requireOwnedForUpdate(date);
        log.waterById(waterId).update(request.loggedAt(), request.volumeMl(), clock.instant());
        return response(log);
    }

    @Transactional
    DailyLogResponse deleteWater(LocalDate date, UUID waterId) {
        DailyLog log = requireOwnedForUpdate(date);
        log.removeWater(log.waterById(waterId), clock.instant());
        return response(log);
    }

    @Transactional
    DailyLogResponse close(LocalDate date, CloseDailyLogRequest request) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        DailyLog log = findOrCreate(userId, date);
        log.close(request.fastingConfirmed(), clock.instant());
        return response(log);
    }

    @Transactional
    DailyLogResponse reopen(LocalDate date) {
        DailyLog log = requireOwnedForUpdate(date);
        log.reopen(clock.instant());
        return response(log);
    }

    @Transactional
    DailyLogResponse copyMeal(LocalDate targetDate, CopyMealRequest request) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return idempotent(userId, targetDate, request.requestId(), "COPY_MEAL", () -> {
            DailyLog source = requireLog(userId, request.sourceDate());
            Meal sourceMeal = source.mealById(request.sourceMealId());
            DailyLog target = findOrCreate(userId, targetDate);
            target.copyMeal(sourceMeal, clock.instant());
            return target;
        });
    }

    @Transactional
    DailyLogResponse copyDay(LocalDate targetDate, CopyDayRequest request) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        if (targetDate.equals(request.sourceDate())) {
            throw new DiaryValidationException("sourceDate", "A origem deve ser diferente do dia de destino.");
        }
        return idempotent(userId, targetDate, request.requestId(), "COPY_DAY", () -> {
            DailyLog source = requireLog(userId, request.sourceDate());
            DailyLog target = findOrCreate(userId, targetDate);
            target.requireOpen();
            if (!target.meals().isEmpty() || !target.waterLogs().isEmpty()) {
                throw new DiaryConflictException("O dia de destino deve estar vazio para ser duplicado.");
            }
            Instant now = clock.instant();
            source.meals().forEach(meal -> target.copyMeal(meal, now));
            long days = ChronoUnit.DAYS.between(request.sourceDate(), targetDate);
            source.waterLogs().forEach(water -> target.addWater(water.loggedAt().plus(days, ChronoUnit.DAYS), water.volumeMl(), now));
            return target;
        });
    }

    private ResolvedItem resolve(UpsertMealItemRequest request) {
        if (request.quantity() == null || request.quantity().signum() <= 0) {
            throw new DiaryValidationException("quantity", "A quantidade deve ser maior que zero.");
        }
        CatalogNutritionSnapshot resolved;
        try {
            resolved = catalogNutritionProvider.resolve(
                    request.itemType(), request.versionId(), request.quantity(), request.unit(), request.servingOptionId());
        } catch (CatalogNutritionResolutionException exception) {
            String field = switch (exception.reason()) {
                case INVALID_QUANTITY -> "quantity";
                case INVALID_UNIT -> "unit";
                case INVALID_SERVING -> "servingOptionId";
                case NOT_FOUND -> throw new DiaryNotFoundException(exception.getMessage());
            };
            throw new DiaryValidationException(field, exception.getMessage());
        }
        BigDecimal conversionFactor = resolved.equivalentBasisQuantity()
                .divide(resolved.inputQuantity(), 8, RoundingMode.HALF_UP);
        var nutrients = resolved.nutrients();
        MealItemSnapshot snapshot = new MealItemSnapshot(
                resolved.type(), resolved.versionId(), resolved.servingOptionId(), resolved.inputQuantity(),
                resolved.inputUnit().name(), resolved.equivalentBasisQuantity(), resolved.basisQuantity(),
                resolved.basisUnit().name(),
                conversionFactor, resolved.name(), nutrients.caloriesKcal(), nutrients.proteinG(),
                nutrients.carbohydrateG(), nutrients.fatG(), nutrients.fiberG(), nutrients.sodiumMg());
        return new ResolvedItem(snapshot, DataQuality.valueOf(resolved.quality().name()), resolved.kcalUncertainty());
    }

    private DailyLogResponse idempotent(
            UUID userId, LocalDate date, UUID requestId, String operation, Supplier<DailyLog> action) {
        if (requestId != null) {
            acquireIdempotencyLock(userId, requestId);
            var existing = idempotencyKeys.findById(new DiaryIdempotencyId(userId, requestId));
            if (existing.isPresent()) {
                DiaryIdempotencyKey key = existing.get();
                if (!operation.equals(key.operation()) || !date.equals(key.logDate())) {
                    throw new DiaryConflictException("O requestId já foi utilizado em outra operação.");
                }
                return response(requireLog(userId, date));
            }
        }
        DailyLog log = action.get();
        dailyLogs.save(log);
        if (requestId != null) {
            try {
                idempotencyKeys.saveAndFlush(new DiaryIdempotencyKey(
                        userId, requestId, operation, date, log.id(), clock.instant()));
            } catch (DataIntegrityViolationException exception) {
                throw new DiaryConflictException("O requestId já foi processado por outra requisição.");
            }
        }
        return response(log);
    }

    private void acquireIdempotencyLock(UUID userId, UUID requestId) {
        String key = userId + ":request:" + requestId;
        jdbcTemplate.queryForObject(
                "select pg_advisory_xact_lock(hashtextextended(?, 0)) is null",
                Boolean.class,
                key);
    }

    private DailyLog findOrCreate(UUID userId, LocalDate date) {
        acquireCreationLock(userId, date);
        return dailyLogs.findForUpdate(userId, date).orElseGet(() -> dailyLogs.save(DailyLog.create(userId, date, clock.instant())));
    }

    private void acquireCreationLock(UUID userId, LocalDate date) {
        String key = userId + ":" + date;
        jdbcTemplate.queryForObject(
                "select pg_advisory_xact_lock(hashtextextended(?, 0)) is null",
                Boolean.class,
                key);
    }

    private DailyLog requireOwnedForUpdate(LocalDate date) {
        UUID userId = currentUserProvider.requireCurrentUser().id();
        return requireLogForUpdate(userId, date);
    }

    private DailyLog requireLogForUpdate(UUID userId, LocalDate date) {
        return dailyLogs.findForUpdate(userId, date)
                .orElseThrow(() -> new DiaryNotFoundException("Diário não encontrado em " + date + "."));
    }

    private DailyLog requireLog(UUID userId, LocalDate date) {
        return dailyLogs.findByUserIdAndDate(userId, date)
                .orElseThrow(() -> new DiaryNotFoundException("Diário não encontrado em " + date + "."));
    }

    private DailyLogResponse response(DailyLog log) {
        return DailyLogResponse.from(
                log,
                planningDataProvider.effectiveTdeeKcal(log.date()).orElse(null),
                planningDataProvider.effectiveNutritionGoals(log.date()).orElse(null));
    }

    private record ResolvedItem(MealItemSnapshot snapshot, DataQuality quality, BigDecimal uncertainty) {}
}

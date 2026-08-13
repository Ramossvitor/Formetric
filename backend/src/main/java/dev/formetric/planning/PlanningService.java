package dev.formetric.planning;

import dev.formetric.identity.CurrentUserProvider;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class PlanningService {

    private final NutritionGoalPeriodRepository nutritionGoalPeriods;
    private final TdeePeriodRepository tdeePeriods;
    private final CurrentUserProvider currentUserProvider;
    private final Clock clock;

    PlanningService(
            NutritionGoalPeriodRepository nutritionGoalPeriods,
            TdeePeriodRepository tdeePeriods,
            CurrentUserProvider currentUserProvider,
            Clock clock) {
        this.nutritionGoalPeriods = nutritionGoalPeriods;
        this.tdeePeriods = tdeePeriods;
        this.currentUserProvider = currentUserProvider;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    List<NutritionGoalPeriodResponse> listNutritionGoalPeriods() {
        var userId = currentUserProvider.requireCurrentUser().id();
        return nutritionGoalPeriods.findAllByUserIdOrderByValidFromAsc(userId).stream()
                .map(NutritionGoalPeriodResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    NutritionGoalPeriodResponse effectiveNutritionGoalPeriod(LocalDate date) {
        var userId = currentUserProvider.requireCurrentUser().id();
        return nutritionGoalPeriods.findEffective(userId, date)
                .map(NutritionGoalPeriodResponse::from)
                .orElseThrow(() -> new PlanningPeriodNotFoundException(
                        "Não existe meta nutricional vigente em " + date + "."));
    }

    @Transactional
    NutritionGoalPeriodResponse createNutritionGoalPeriod(CreateNutritionGoalPeriodRequest request) {
        var userId = currentUserProvider.requireCurrentUser().id();
        PlanningRules.validateInterval(request.validFrom(), request.validTo());
        if (request.calorieTarget() != null) {
            PlanningRules.validatePositive("calorieTarget", request.calorieTarget());
        }
        List<NutrientTargetDefinition> targets = PlanningRules.validateAndNormalizeTargets(
                request.targets().stream().map(NutrientTargetRequest::toDefinition).toList());
        Instant now = clock.instant();

        try {
            closeOpenNutritionPeriodWhenAppendingCurrentOrFuture(userId, request.validFrom(), now);
            NutritionGoalPeriod period = NutritionGoalPeriod.create(
                    userId,
                    request.validFrom(),
                    request.validTo(),
                    request.calorieTarget(),
                    targets,
                    now);
            return NutritionGoalPeriodResponse.from(nutritionGoalPeriods.saveAndFlush(period));
        } catch (DataIntegrityViolationException exception) {
            throw new PlanningConflictException(
                    "O período de metas nutricionais se sobrepõe a uma vigência existente.", exception);
        }
    }

    @Transactional(readOnly = true)
    List<TdeePeriodResponse> listTdeePeriods() {
        var userId = currentUserProvider.requireCurrentUser().id();
        return tdeePeriods.findAllByUserIdOrderByValidFromAsc(userId).stream()
                .map(TdeePeriodResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    TdeePeriodResponse effectiveTdeePeriod(LocalDate date) {
        var userId = currentUserProvider.requireCurrentUser().id();
        return tdeePeriods.findEffective(userId, date)
                .map(TdeePeriodResponse::from)
                .orElseThrow(() -> new PlanningPeriodNotFoundException(
                        "Não existe TDEE vigente em " + date + "."));
    }

    @Transactional
    TdeePeriodResponse createTdeePeriod(CreateTdeePeriodRequest request) {
        var userId = currentUserProvider.requireCurrentUser().id();
        PlanningRules.validateInterval(request.validFrom(), request.validTo());
        PlanningRules.validatePositive("kcalPerDay", request.kcalPerDay());
        Instant now = clock.instant();

        try {
            closeOpenTdeePeriodWhenAppendingCurrentOrFuture(userId, request.validFrom(), now);
            TdeePeriod period = TdeePeriod.create(
                    userId, request.validFrom(), request.validTo(), request.kcalPerDay(), now);
            return TdeePeriodResponse.from(tdeePeriods.saveAndFlush(period));
        } catch (DataIntegrityViolationException exception) {
            throw new PlanningConflictException(
                    "O período de TDEE se sobrepõe a uma vigência existente.", exception);
        }
    }

    private void closeOpenNutritionPeriodWhenAppendingCurrentOrFuture(
            java.util.UUID userId, LocalDate nextValidFrom, Instant now) {
        if (nextValidFrom.isBefore(LocalDate.now(clock))) {
            return;
        }
        nutritionGoalPeriods.findOpenPrecedingForUpdate(userId, nextValidFrom)
                .ifPresent(period -> period.closeAt(nextValidFrom, now));
        nutritionGoalPeriods.flush();
    }

    private void closeOpenTdeePeriodWhenAppendingCurrentOrFuture(
            java.util.UUID userId, LocalDate nextValidFrom, Instant now) {
        if (nextValidFrom.isBefore(LocalDate.now(clock))) {
            return;
        }
        tdeePeriods.findOpenPrecedingForUpdate(userId, nextValidFrom)
                .ifPresent(period -> period.closeAt(nextValidFrom, now));
        tdeePeriods.flush();
    }
}

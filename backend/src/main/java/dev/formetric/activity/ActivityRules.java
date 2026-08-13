package dev.formetric.activity;

import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class WorkoutRules {

    private static final BigDecimal MAX_ESTIMATED_KCAL = new BigDecimal("100000");

    private WorkoutRules() {
    }

    static void validate(WorkoutDetails details) {
        if (details == null) {
            throw new ActivityValidationException("workout", "Os dados do treino são obrigatórios.");
        }
        if (details.date() == null) {
            throw new ActivityValidationException("date", "A data do treino é obrigatória.");
        }
        if (details.modality() == null) {
            throw new ActivityValidationException("modality", "A modalidade é obrigatória.");
        }
        String title = optionalTrimmed(details.title());
        if (title == null || title.length() > 120) {
            throw new ActivityValidationException("title", "O título deve ter entre 1 e 120 caracteres.");
        }
        String customModality = optionalTrimmed(details.customModality());
        if (details.modality() == WorkoutModality.OTHER) {
            if (customModality == null || customModality.length() > 80) {
                throw new ActivityValidationException(
                        "customModality", "Informe uma modalidade personalizada de até 80 caracteres.");
            }
        } else if (customModality != null) {
            throw new ActivityValidationException(
                    "customModality", "A modalidade personalizada só pode ser usada com OTHER.");
        }
        List<String> groups = normalizeMuscleGroups(details.muscleGroups());
        if (details.modality() == WorkoutModality.STRENGTH && groups.isEmpty()) {
            throw new ActivityValidationException(
                    "muscleGroups", "Informe ao menos um grupo muscular para musculação.");
        }
        if (details.durationMinutes() < 1 || details.durationMinutes() > 1440) {
            throw new ActivityValidationException(
                    "durationMinutes", "A duração deve estar entre 1 e 1440 minutos.");
        }
        if (details.estimatedKcal() != null
                && (details.estimatedKcal().signum() < 0
                || details.estimatedKcal().compareTo(MAX_ESTIMATED_KCAL) > 0)) {
            throw new ActivityValidationException(
                    "estimatedKcal", "O gasto estimado deve estar entre 0 e 100000 kcal.");
        }
        if (details.notes() != null && details.notes().length() > 2000) {
            throw new ActivityValidationException("notes", "As observações devem ter no máximo 2000 caracteres.");
        }
    }

    static List<String> normalizeMuscleGroups(List<String> input) {
        if (input == null || input.isEmpty()) {
            return List.of();
        }
        if (input.size() > 20) {
            throw new ActivityValidationException("muscleGroups", "Informe no máximo 20 grupos musculares.");
        }
        List<String> normalized = new ArrayList<>();
        Set<String> unique = new LinkedHashSet<>();
        for (String raw : input) {
            String group = optionalTrimmed(raw);
            if (group == null || group.length() > 50) {
                throw new ActivityValidationException(
                        "muscleGroups", "Cada grupo muscular deve ter entre 1 e 50 caracteres.");
            }
            if (!unique.add(group.toLowerCase(Locale.ROOT))) {
                throw new ActivityValidationException("muscleGroups", "Os grupos musculares não podem se repetir.");
            }
            normalized.add(group);
        }
        return List.copyOf(normalized);
    }

    static String optionalTrimmed(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    static String optionalPreservingWhitespace(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}

final class WeightRules {

    private static final BigDecimal MAX_WEIGHT_KG = new BigDecimal("1000");

    private WeightRules() {
    }

    static void validate(WeightDetails details) {
        if (details == null || details.weightKg() == null) {
            throw new ActivityValidationException("weightKg", "O peso é obrigatório.");
        }
        if (details.weightKg().signum() <= 0 || details.weightKg().compareTo(MAX_WEIGHT_KG) > 0) {
            throw new ActivityValidationException("weightKg", "O peso deve ser maior que 0 e de até 1000 kg.");
        }
        if (details.measuredAt() == null) {
            throw new ActivityValidationException("measuredAt", "O horário da pesagem é obrigatório.");
        }
        String condition = WorkoutRules.optionalTrimmed(details.condition());
        if (condition != null && condition.length() > 120) {
            throw new ActivityValidationException(
                    "condition", "A condição da pesagem deve ter no máximo 120 caracteres.");
        }
        if (details.notes() != null && details.notes().length() > 2000) {
            throw new ActivityValidationException("notes", "As observações devem ter no máximo 2000 caracteres.");
        }
    }
}

final class ActivityRangeRules {

    private static final int MAX_RANGE_YEARS = 5;

    private ActivityRangeRules() {
    }

    static void validate(LocalDate from, LocalDate to) {
        if (from == null) {
            throw new ActivityValidationException("from", "A data inicial é obrigatória.");
        }
        if (to == null) {
            throw new ActivityValidationException("to", "A data final é obrigatória.");
        }
        if (from.isAfter(to)) {
            throw new ActivityValidationException("to", "A data final não pode ser anterior à data inicial.");
        }
        if (to.isAfter(maximumInclusiveTo(from))) {
            throw new ActivityValidationException(
                    "to", "O intervalo consultado deve ter no máximo cinco anos.");
        }
    }

    private static LocalDate maximumInclusiveTo(LocalDate from) {
        try {
            return from.plusYears(MAX_RANGE_YEARS).minusDays(1);
        } catch (DateTimeException exception) {
            return LocalDate.MAX;
        }
    }
}

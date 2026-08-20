package dev.formetric.planning;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class PlanningRules {

    private PlanningRules() {
    }

    static void validateInterval(LocalDate validFrom, LocalDate validTo) {
        if (validFrom == null) {
            throw new PlanningValidationException("validFrom", "A data inicial é obrigatória.");
        }
        if (validTo != null && !validTo.isAfter(validFrom)) {
            throw new PlanningValidationException(
                    "validTo", "A data final deve ser posterior à data inicial.");
        }
    }

    static void validatePositive(String field, BigDecimal value) {
        if (value == null || value.signum() <= 0) {
            throw new PlanningValidationException(field, "O valor deve ser maior que zero.");
        }
    }

    static List<NutrientTargetDefinition> validateAndNormalizeTargets(List<NutrientTargetDefinition> targets) {
        if (targets == null) {
            throw new PlanningValidationException("targets", "A lista de metas é obrigatória.");
        }
        if (targets.size() > NutrientType.values().length) {
            throw new PlanningValidationException(
                    "targets", "Cada nutriente pode aparecer no máximo uma vez.");
        }

        Set<NutrientType> seen = EnumSet.noneOf(NutrientType.class);
        List<NutrientTargetDefinition> normalized = new ArrayList<>(targets.size());
        for (NutrientTargetDefinition target : targets) {
            if (target == null || target.nutrient() == null || target.unit() == null) {
                throw new PlanningValidationException(
                        "targets", "Nutriente e unidade são obrigatórios.");
            }
            if (!seen.add(target.nutrient())) {
                throw new PlanningValidationException(
                        "targets", "Não é permitido repetir o nutriente " + target.nutrient() + ".");
            }
            NutritionUnit expectedUnit = target.nutrient() == NutrientType.WATER
                    ? NutritionUnit.ML
                    : NutritionUnit.G;
            if (target.unit() != expectedUnit) {
                throw new PlanningValidationException(
                        "targets",
                        "A unidade de " + target.nutrient() + " deve ser " + expectedUnit + ".");
            }
            normalized.add(new NutrientTargetDefinition(
                    target.nutrient(), target.unit(), validateAndOrderBands(target.bands())));
        }
        return List.copyOf(normalized);
    }

    static List<GoalBandDefinition> validateAndOrderBands(List<GoalBandDefinition> bands) {
        if (bands == null || bands.isEmpty()) {
            throw new PlanningValidationException(
                    "bands", "Cada meta de nutriente deve possuir ao menos uma faixa.");
        }
        if (bands.size() > 20) {
            throw new PlanningValidationException(
                    "bands", "Cada meta de nutriente pode possuir no máximo 20 faixas.");
        }

        List<GoalBandDefinition> ordered = new ArrayList<>(bands.size());
        for (GoalBandDefinition band : bands) {
            if (band == null) {
                throw new PlanningValidationException("bands", "Uma faixa não pode ser nula.");
            }
            if (band.minimum() != null && band.minimum().signum() < 0
                    || band.maximum() != null && band.maximum().signum() < 0) {
                throw new PlanningValidationException("bands", "Os limites não podem ser negativos.");
            }
            if (band.minimum() != null
                    && band.maximum() != null
                    && band.minimum().compareTo(band.maximum()) > 0) {
                throw new PlanningValidationException(
                        "bands", "O limite mínimo não pode ser maior que o máximo.");
            }
            if (band.minimum() != null
                    && band.maximum() != null
                    && band.minimum().compareTo(band.maximum()) == 0
                    && !(band.minimumInclusive() && band.maximumInclusive())) {
                throw new PlanningValidationException(
                        "bands", "Limites iguais precisam incluir as duas fronteiras.");
            }
            if (band.label() == null || band.label().strip().isEmpty() || band.label().strip().length() > 40) {
                throw new PlanningValidationException("bands", "O rótulo deve possuir entre 1 e 40 caracteres.");
            }
            if (band.tone() == null) {
                throw new PlanningValidationException("bands", "O tom da faixa é obrigatório.");
            }
            if (band.position() < 0) {
                throw new PlanningValidationException("bands", "A posição da faixa não pode ser negativa.");
            }
            ordered.add(new GoalBandDefinition(
                    band.position(),
                    band.minimum(),
                    band.maximum(),
                    band.minimumInclusive(),
                    band.maximumInclusive(),
                    band.label().strip(),
                    band.tone(),
                    band.countsAsAttained()));
        }

        if (ordered.stream().noneMatch(GoalBandDefinition::countsAsAttained)) {
            throw new PlanningValidationException(
                    "bands", "Marque ao menos uma faixa como meta atingida.");
        }

        Set<Integer> positions = new HashSet<>();
        ordered.forEach(band -> {
            if (!positions.add(band.position())) {
                throw new PlanningValidationException("bands", "As posições das faixas não podem se repetir.");
            }
        });
        ordered.sort(java.util.Comparator.comparingInt(GoalBandDefinition::position));
        for (int index = 0; index < ordered.size(); index++) {
            if (ordered.get(index).position() != index) {
                throw new PlanningValidationException(
                        "bands", "As posições das faixas devem ser sequenciais, começando em zero.");
            }
        }

        for (int index = 1; index < ordered.size(); index++) {
            GoalBandDefinition previous = ordered.get(index - 1);
            GoalBandDefinition current = ordered.get(index);
            if (overlaps(previous, current)) {
                throw new PlanningValidationException("bands", "As faixas de uma meta não podem se sobrepor.");
            }
        }
        return List.copyOf(ordered);
    }

    private static boolean overlaps(GoalBandDefinition previous, GoalBandDefinition current) {
        if (previous.maximum() == null || current.minimum() == null) {
            return true;
        }
        int comparison = previous.maximum().compareTo(current.minimum());
        return comparison > 0
                || comparison == 0 && previous.maximumInclusive() && current.minimumInclusive();
    }
}

record NutrientTargetDefinition(
        NutrientType nutrient,
        NutritionUnit unit,
        List<GoalBandDefinition> bands) {
}

record GoalBandDefinition(
        int position,
        BigDecimal minimum,
        BigDecimal maximum,
        boolean minimumInclusive,
        boolean maximumInclusive,
        String label,
        GoalTone tone,
        boolean countsAsAttained) {
}

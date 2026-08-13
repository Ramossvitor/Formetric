package dev.formetric.body;

import dev.formetric.identity.FormulaSex;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class BodyComparison {

    private BodyComparison() {
    }

    static BodyEvaluationComparisonResponse compare(
            BodyEvaluationVersion baseline,
            BodyEvaluationVersion followUp) {
        BigDecimal circumferenceSumDelta = compatibleCircumferenceSumDelta(baseline, followUp);
        BigDecimal skinfoldSumDelta = compatibleSkinfoldSumDelta(baseline, followUp);
        List<BodyResultDeltaResponse> resultDeltas = resultDeltas(
                baseline, followUp, circumferenceSumDelta, skinfoldSumDelta);
        List<CircumferenceDeltaResponse> circumferenceDeltas = circumferenceDeltas(baseline, followUp);
        List<SkinfoldDeltaResponse> skinfoldDeltas = skinfoldDeltas(baseline, followUp);
        List<BodyWarningResponse> warnings = comparisonWarnings(baseline, followUp, resultDeltas);

        return new BodyEvaluationComparisonResponse(
                BodyEvaluationComparisonPointResponse.from(baseline),
                BodyEvaluationComparisonPointResponse.from(followUp),
                Math.toIntExact(java.time.temporal.ChronoUnit.DAYS.between(
                        baseline.assessmentDate(), followUp.assessmentDate())),
                delta(baseline.weightKg(), followUp.weightKg()),
                resultDeltas,
                circumferenceDeltas,
                skinfoldDeltas,
                circumferenceSumDelta,
                skinfoldSumDelta,
                warnings);
    }

    private static List<BodyResultDeltaResponse> resultDeltas(
            BodyEvaluationVersion baseline,
            BodyEvaluationVersion followUp,
            BigDecimal circumferenceSumDelta,
            BigDecimal skinfoldSumDelta) {
        Map<ResultKey, BodyCompositionResult> baselineResults = bySemanticResultKey(baseline.results());
        Map<ResultKey, BodyCompositionResult> followUpResults = bySemanticResultKey(followUp.results());
        Set<ResultKey> keys = new java.util.TreeSet<>(Comparator
                .comparing((ResultKey key) -> key.metric().name())
                .thenComparing(key -> key.provenance().name()));
        keys.addAll(baselineResults.keySet());
        keys.addAll(followUpResults.keySet());

        return keys.stream().map(key -> {
            BodyCompositionResult before = baselineResults.get(key);
            BodyCompositionResult after = followUpResults.get(key);
            BodyComparisonCompatibility compatibility = compatibility(baseline, before, followUp, after);
            boolean calculated = key.provenance() == BodyResultProvenance.SYSTEM_CALCULATED;
            boolean incompatibleAggregate = calculated
                    && (key.metric() == BodyResultMetric.CIRCUMFERENCE_SUM_CM
                    && circumferenceSumDelta == null
                    || key.metric() == BodyResultMetric.SKINFOLD_SUM_MM
                    && skinfoldSumDelta == null);
            if (incompatibleAggregate && before != null && after != null) {
                compatibility = BodyComparisonCompatibility.METHOD_CHANGED;
            }
            BigDecimal delta = before == null || after == null
                    || incompatibleAggregate
                    ? null
                    : after.value().subtract(before.value());
            return new BodyResultDeltaResponse(
                    key.metric(), key.provenance(), compatibility,
                    before == null ? null : BodyResultResponse.from(before),
                    after == null ? null : BodyResultResponse.from(after),
                    delta);
        }).toList();
    }

    private static BodyComparisonCompatibility compatibility(
            BodyEvaluationVersion baselineVersion,
            BodyCompositionResult baseline,
            BodyEvaluationVersion followUpVersion,
            BodyCompositionResult followUp) {
        if (baseline == null || followUp == null) {
            return BodyComparisonCompatibility.MISSING;
        }
        if (!baseline.methodCode().equals(followUp.methodCode())
                || baseline.methodRevision() != followUp.methodRevision()) {
            return BodyComparisonCompatibility.METHOD_CHANGED;
        }
        if (baseline.provenance() == BodyResultProvenance.REPORTED
                || baseline.provenance() == BodyResultProvenance.SYSTEM_DERIVED_FROM_REPORTED) {
            if (baselineVersion.reportedMethodType() != followUpVersion.reportedMethodType()
                    || !java.util.Objects.equals(
                            baselineVersion.reportedMethodLabel(), followUpVersion.reportedMethodLabel())) {
                return BodyComparisonCompatibility.METHOD_CHANGED;
            }
        }
        if (baseline.provenance() == BodyResultProvenance.SYSTEM_CALCULATED
                && BodyCalculations.JACKSON_POLLOCK_7_SIRI_1961.equals(baseline.methodCode())
                && usesFormulaSex(baseline.metric())) {
            if (baselineVersion.formulaSex() != followUpVersion.formulaSex()
                    || !skinfoldMap(baselineVersion).keySet().equals(skinfoldMap(followUpVersion).keySet())) {
                return BodyComparisonCompatibility.METHOD_CHANGED;
            }
        }
        return BodyComparisonCompatibility.SAME_METHOD;
    }

    private static boolean usesFormulaSex(BodyResultMetric metric) {
        return EnumSet.of(
                BodyResultMetric.BODY_DENSITY_G_PER_ML,
                BodyResultMetric.BODY_FAT_PERCENT,
                BodyResultMetric.FAT_MASS_KG,
                BodyResultMetric.FAT_FREE_MASS_PERCENT,
                BodyResultMetric.FAT_FREE_MASS_KG).contains(metric);
    }

    private static Map<ResultKey, BodyCompositionResult> bySemanticResultKey(
            List<BodyCompositionResult> results) {
        Map<ResultKey, BodyCompositionResult> mapped = new LinkedHashMap<>();
        for (BodyCompositionResult result : results) {
            ResultKey key = new ResultKey(result.metric(), result.provenance());
            BodyCompositionResult previous = mapped.putIfAbsent(key, result);
            if (previous != null) {
                throw new IllegalStateException("Mais de um resultado usa a mesma métrica e proveniência.");
            }
        }
        return mapped;
    }

    private static List<CircumferenceDeltaResponse> circumferenceDeltas(
            BodyEvaluationVersion baseline,
            BodyEvaluationVersion followUp) {
        Map<CircumferenceSite, BigDecimal> before = circumferenceMap(baseline);
        Map<CircumferenceSite, BigDecimal> after = circumferenceMap(followUp);
        Set<CircumferenceSite> sites = EnumSet.noneOf(CircumferenceSite.class);
        sites.addAll(before.keySet());
        sites.addAll(after.keySet());
        return sites.stream().map(site -> new CircumferenceDeltaResponse(
                site, before.get(site), after.get(site), delta(before.get(site), after.get(site)))).toList();
    }

    private static List<SkinfoldDeltaResponse> skinfoldDeltas(
            BodyEvaluationVersion baseline,
            BodyEvaluationVersion followUp) {
        Map<SkinfoldKey, BodySkinfold> before = skinfoldMap(baseline);
        Map<SkinfoldKey, BodySkinfold> after = skinfoldMap(followUp);
        Set<SkinfoldKey> sites = new java.util.TreeSet<>(Comparator
                .comparing((SkinfoldKey key) -> key.site().name())
                .thenComparing(key -> key.side().name()));
        sites.addAll(before.keySet());
        sites.addAll(after.keySet());
        return sites.stream().map(key -> {
            BodySkinfold first = before.get(key);
            BodySkinfold second = after.get(key);
            return new SkinfoldDeltaResponse(
                    key.site(),
                    key.side(),
                    first == null ? null : first.valueMm(),
                    second == null ? null : second.valueMm(),
                    first == null || second == null
                            ? null
                            : second.valueMm().subtract(first.valueMm()));
        }).toList();
    }

    private static BigDecimal compatibleCircumferenceSumDelta(
            BodyEvaluationVersion baseline,
            BodyEvaluationVersion followUp) {
        Map<CircumferenceSite, BigDecimal> before = circumferenceMap(baseline);
        Map<CircumferenceSite, BigDecimal> after = circumferenceMap(followUp);
        return !before.isEmpty() && before.keySet().equals(after.keySet())
                ? sum(after.values()).subtract(sum(before.values()))
                : null;
    }

    private static BigDecimal compatibleSkinfoldSumDelta(
            BodyEvaluationVersion baseline,
            BodyEvaluationVersion followUp) {
        Map<SkinfoldKey, BodySkinfold> before = skinfoldMap(baseline);
        Map<SkinfoldKey, BodySkinfold> after = skinfoldMap(followUp);
        if (before.size() != SkinfoldSite.values().length || !before.keySet().equals(after.keySet())) {
            return null;
        }
        return sum(after.values().stream().map(BodySkinfold::valueMm).toList())
                .subtract(sum(before.values().stream().map(BodySkinfold::valueMm).toList()));
    }

    private static List<BodyWarningResponse> comparisonWarnings(
            BodyEvaluationVersion baseline,
            BodyEvaluationVersion followUp,
            List<BodyResultDeltaResponse> resultDeltas) {
        Map<String, BodyWarningResponse> warnings = new LinkedHashMap<>();
        BodyEvaluationService.recalculate(baseline).warnings().stream()
                .map(BodyWarningResponse::from)
                .forEach(warning -> warnings.putIfAbsent("BASELINE_" + warning.code(),
                        new BodyWarningResponse("BASELINE_" + warning.code(), warning.message())));
        BodyEvaluationService.recalculate(followUp).warnings().stream()
                .map(BodyWarningResponse::from)
                .forEach(warning -> warnings.putIfAbsent("FOLLOW_UP_" + warning.code(),
                        new BodyWarningResponse("FOLLOW_UP_" + warning.code(), warning.message())));
        if (resultDeltas.stream().anyMatch(delta -> delta.compatibility() == BodyComparisonCompatibility.METHOD_CHANGED)) {
            warnings.put("METHOD_CHANGED", new BodyWarningResponse(
                    "METHOD_CHANGED",
                    "Há resultados calculados ou informados por métodos diferentes; interprete esses deltas com cautela."));
        }
        return new ArrayList<>(warnings.values());
    }

    private static Map<CircumferenceSite, BigDecimal> circumferenceMap(BodyEvaluationVersion version) {
        Map<CircumferenceSite, BigDecimal> result = new EnumMap<>(CircumferenceSite.class);
        version.circumferences().forEach(value -> result.put(value.site(), value.valueCm()));
        return result;
    }

    private static Map<SkinfoldKey, BodySkinfold> skinfoldMap(BodyEvaluationVersion version) {
        Map<SkinfoldKey, BodySkinfold> result = new LinkedHashMap<>();
        version.skinfolds().forEach(value -> result.put(new SkinfoldKey(value.site(), value.side()), value));
        return result;
    }

    private static BigDecimal delta(BigDecimal baseline, BigDecimal followUp) {
        return baseline == null || followUp == null ? null : followUp.subtract(baseline);
    }

    private static BigDecimal sum(Iterable<BigDecimal> values) {
        BigDecimal sum = BigDecimal.ZERO;
        for (BigDecimal value : values) {
            sum = sum.add(value);
        }
        return sum;
    }

    private record ResultKey(BodyResultMetric metric, BodyResultProvenance provenance) {
    }

    private record SkinfoldKey(SkinfoldSite site, MeasurementSide side) {
    }
}

record BodyEvaluationComparisonResponse(
        BodyEvaluationComparisonPointResponse baseline,
        BodyEvaluationComparisonPointResponse followUp,
        int daysBetween,
        BigDecimal weightDeltaKg,
        List<BodyResultDeltaResponse> resultDeltas,
        List<CircumferenceDeltaResponse> circumferenceDeltas,
        List<SkinfoldDeltaResponse> skinfoldDeltas,
        BigDecimal circumferenceSumDeltaCm,
        BigDecimal skinfoldSumDeltaMm,
        List<BodyWarningResponse> warnings) {
}

record BodyEvaluationComparisonPointResponse(
        java.util.UUID evaluationId,
        java.util.UUID versionId,
        int versionNumber,
        LocalDate assessmentDate,
        String title,
        BodyEvaluationSource source,
        BigDecimal weightKg,
        FormulaSex formulaSex,
        BodyCompositionProtocol protocol,
        Integer protocolRevision,
        ReportedMethodType reportedMethodType,
        String reportedMethodLabel) {
    static BodyEvaluationComparisonPointResponse from(BodyEvaluationVersion version) {
        return new BodyEvaluationComparisonPointResponse(
                version.evaluation().id(), version.id(), version.versionNumber(), version.assessmentDate(),
                version.title(), version.source(), version.weightKg(), version.formulaSex(), version.protocol(),
                version.protocolRevision(), version.reportedMethodType(), version.reportedMethodLabel());
    }
}

record BodyResultDeltaResponse(
        BodyResultMetric metric,
        BodyResultProvenance provenance,
        BodyComparisonCompatibility compatibility,
        BodyResultResponse baselineResult,
        BodyResultResponse followUpResult,
        BigDecimal delta) {
}

record CircumferenceDeltaResponse(
        CircumferenceSite site,
        BigDecimal baselineValueCm,
        BigDecimal followUpValueCm,
        BigDecimal deltaCm) {
}

record SkinfoldDeltaResponse(
        SkinfoldSite site,
        MeasurementSide side,
        BigDecimal baselineValueMm,
        BigDecimal followUpValueMm,
        BigDecimal deltaMm) {
}

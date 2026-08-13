package dev.formetric.body;

import dev.formetric.identity.CurrentUserProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Read-only body snapshots for deterministic analytics without exposing persistence entities. */
@Component
public class BodyDataProvider {

    private final BodyEvaluationVersionRepository versions;
    private final CurrentUserProvider currentUserProvider;

    BodyDataProvider(
            BodyEvaluationVersionRepository versions,
            CurrentUserProvider currentUserProvider) {
        this.versions = versions;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public List<EvaluationData> currentEvaluations(LocalDate from, LocalDate to) {
        validateRange(from, to);
        UUID userId = currentUserProvider.requireCurrentUser().id();
        List<BodyEvaluationVersion> snapshots = versions.findActiveCurrentInRange(userId, from, to);
        snapshots.forEach(snapshot -> {
            snapshot.circumferences().size();
            snapshot.skinfolds().size();
            snapshot.results().size();
        });
        return snapshots.stream().map(snapshot -> new EvaluationData(
                snapshot.evaluation().id(),
                snapshot.id(),
                snapshot.versionNumber(),
                snapshot.assessmentDate(),
                snapshot.weightKg(),
                snapshot.circumferences().stream()
                        .map(value -> new MeasurementData(value.site().name(), value.valueCm())).toList(),
                snapshot.skinfolds().stream()
                        .map(value -> new SkinfoldData(value.site().name(), value.side().name(), value.valueMm())).toList(),
                snapshot.results().stream()
                        .map(value -> new ResultData(
                                value.metric().name(), value.value(), value.provenance().name(),
                                value.methodCode(), value.methodRevision()))
                        .toList())).toList();
    }

    private static void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new IllegalArgumentException("Body analytics requires a valid inclusive date range.");
        }
        if (ChronoUnit.DAYS.between(from, to) > 3660) {
            throw new IllegalArgumentException("Body analytics range cannot exceed ten years.");
        }
    }

    public record EvaluationData(
            UUID evaluationId,
            UUID versionId,
            int versionNumber,
            LocalDate assessmentDate,
            BigDecimal weightKg,
            List<MeasurementData> circumferences,
            List<SkinfoldData> skinfolds,
            List<ResultData> results) {
    }

    public record MeasurementData(String site, BigDecimal valueCm) {
    }

    public record SkinfoldData(String site, String side, BigDecimal valueMm) {
    }

    public record ResultData(
            String metric,
            BigDecimal value,
            String provenance,
            String methodCode,
            int methodRevision) {
    }
}

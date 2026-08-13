package dev.formetric.body;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "body_composition_results")
class BodyCompositionResult {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "evaluation_version_id", nullable = false, updatable = false)
    private BodyEvaluationVersion evaluationVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 48, updatable = false)
    private BodyResultMetric metric;

    @Column(nullable = false, precision = 18, scale = 8, updatable = false)
    private BigDecimal value;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    private BodyResultProvenance provenance;

    @Column(name = "method_code", nullable = false, length = 80, updatable = false)
    private String methodCode;

    @Column(name = "method_revision", nullable = false, updatable = false)
    private int methodRevision;

    @Column(name = "reported_label", length = 160, updatable = false)
    private String reportedLabel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "basis_result_id", updatable = false)
    private BodyCompositionResult basisResult;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected BodyCompositionResult() {
    }

    BodyCompositionResult(
            BodyEvaluationVersion evaluationVersion,
            BodyResultMetric metric,
            BigDecimal value,
            BodyResultProvenance provenance,
            String methodCode,
            int methodRevision,
            String reportedLabel,
            BodyCompositionResult basisResult,
            Instant now) {
        this.id = UUID.randomUUID();
        this.evaluationVersion = evaluationVersion;
        this.metric = metric;
        this.value = value.setScale(8, RoundingMode.HALF_UP);
        this.provenance = provenance;
        this.methodCode = methodCode;
        this.methodRevision = methodRevision;
        this.reportedLabel = reportedLabel;
        this.basisResult = basisResult;
        this.createdAt = now;
    }

    UUID id() { return id; }
    BodyResultMetric metric() { return metric; }
    BigDecimal value() { return value; }
    BodyResultProvenance provenance() { return provenance; }
    String methodCode() { return methodCode; }
    int methodRevision() { return methodRevision; }
    String reportedLabel() { return reportedLabel; }
    UUID basisResultId() { return basisResult == null ? null : basisResult.id(); }
}

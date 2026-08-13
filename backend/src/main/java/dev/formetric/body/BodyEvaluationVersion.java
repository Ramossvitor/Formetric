package dev.formetric.body;

import dev.formetric.identity.FormulaSex;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

@Entity
@Table(name = "body_evaluation_versions")
class BodyEvaluationVersion {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "evaluation_id", nullable = false, updatable = false)
    private BodyEvaluation evaluation;

    @Column(name = "version_number", nullable = false, updatable = false)
    private int versionNumber;

    @Column(name = "assessment_date", nullable = false, updatable = false)
    private LocalDate assessmentDate;

    @Column(nullable = false, length = 160, updatable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24, updatable = false)
    private BodyEvaluationSource source;

    @Column(name = "assessor_name", length = 160, updatable = false)
    private String assessorName;

    @Column(length = 2000, updatable = false)
    private String notes;

    @Column(name = "weight_kg", precision = 7, scale = 3, updatable = false)
    private BigDecimal weightKg;

    @Column(name = "height_cm", precision = 7, scale = 3, updatable = false)
    private BigDecimal heightCm;

    @Column(name = "age_years", updatable = false)
    private Integer ageYears;

    @Enumerated(EnumType.STRING)
    @Column(name = "formula_sex", length = 16, updatable = false)
    private FormulaSex formulaSex;

    @Enumerated(EnumType.STRING)
    @Column(name = "composition_protocol", nullable = false, length = 48, updatable = false)
    private BodyCompositionProtocol protocol;

    @Column(name = "protocol_revision", updatable = false)
    private Integer protocolRevision;

    @Enumerated(EnumType.STRING)
    @Column(name = "reported_method_type", nullable = false, length = 24, updatable = false)
    private ReportedMethodType reportedMethodType;

    @Column(name = "reported_method_label", length = 160, updatable = false)
    private String reportedMethodLabel;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "evaluationVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("site ASC")
    @Fetch(FetchMode.SUBSELECT)
    private List<BodyCircumference> circumferences = new ArrayList<>();

    @OneToMany(mappedBy = "evaluationVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("site ASC")
    @Fetch(FetchMode.SUBSELECT)
    private List<BodySkinfold> skinfolds = new ArrayList<>();

    @OneToMany(mappedBy = "evaluationVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("metric ASC, provenance ASC")
    @Fetch(FetchMode.SUBSELECT)
    private List<BodyCompositionResult> results = new ArrayList<>();

    protected BodyEvaluationVersion() {
    }

    BodyEvaluationVersion(
            BodyEvaluation evaluation,
            int versionNumber,
            BodyEvaluationVersionDefinition definition,
            Integer protocolRevision,
            Instant now) {
        this.id = UUID.randomUUID();
        this.evaluation = evaluation;
        this.versionNumber = versionNumber;
        this.assessmentDate = definition.assessmentDate();
        this.title = definition.title();
        this.source = definition.source();
        this.assessorName = definition.assessorName();
        this.notes = definition.notes();
        this.weightKg = scale3(definition.weightKg());
        this.heightCm = scale3(definition.heightCm());
        this.ageYears = definition.ageYears();
        this.formulaSex = definition.formulaSex();
        this.protocol = definition.protocol();
        this.protocolRevision = protocolRevision;
        this.reportedMethodType = definition.reportedMethodType();
        this.reportedMethodLabel = definition.reportedMethodLabel();
        this.createdAt = now;
    }

    void addCircumference(CircumferenceSite site, BigDecimal valueCm) {
        circumferences.add(new BodyCircumference(this, site, valueCm));
    }

    void addSkinfold(SkinfoldSite site, MeasurementSide side, BigDecimal valueMm) {
        skinfolds.add(new BodySkinfold(this, site, side, valueMm));
    }

    void addResult(BodyCompositionResult result) {
        results.add(result);
    }

    private static BigDecimal scale3(BigDecimal value) {
        return value == null ? null : value.setScale(3, RoundingMode.HALF_UP);
    }

    UUID id() { return id; }
    BodyEvaluation evaluation() { return evaluation; }
    int versionNumber() { return versionNumber; }
    LocalDate assessmentDate() { return assessmentDate; }
    String title() { return title; }
    BodyEvaluationSource source() { return source; }
    String assessorName() { return assessorName; }
    String notes() { return notes; }
    BigDecimal weightKg() { return weightKg; }
    BigDecimal heightCm() { return heightCm; }
    Integer ageYears() { return ageYears; }
    FormulaSex formulaSex() { return formulaSex; }
    BodyCompositionProtocol protocol() { return protocol; }
    Integer protocolRevision() { return protocolRevision; }
    ReportedMethodType reportedMethodType() { return reportedMethodType; }
    String reportedMethodLabel() { return reportedMethodLabel; }
    Instant createdAt() { return createdAt; }
    List<BodyCircumference> circumferences() { return List.copyOf(circumferences); }
    List<BodySkinfold> skinfolds() { return List.copyOf(skinfolds); }
    List<BodyCompositionResult> results() { return List.copyOf(results); }
}

record BodyEvaluationVersionDefinition(
        LocalDate assessmentDate,
        String title,
        BodyEvaluationSource source,
        String assessorName,
        String notes,
        BigDecimal weightKg,
        BigDecimal heightCm,
        Integer ageYears,
        FormulaSex formulaSex,
        BodyCompositionProtocol protocol,
        ReportedMethodType reportedMethodType,
        String reportedMethodLabel,
        List<BodyCircumferenceValue> circumferences,
        List<BodySkinfoldValue> skinfolds,
        List<ReportedBodyResultValue> reportedResults) {
}

record ReportedBodyResultValue(BodyResultMetric metric, BigDecimal value, String reportedLabel) {
}

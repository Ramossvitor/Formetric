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
import java.util.UUID;

@Entity
@Table(name = "body_circumferences")
class BodyCircumference {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "evaluation_version_id", nullable = false, updatable = false)
    private BodyEvaluationVersion evaluationVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24, updatable = false)
    private CircumferenceSite site;

    @Column(name = "value_cm", nullable = false, precision = 8, scale = 3, updatable = false)
    private BigDecimal valueCm;

    protected BodyCircumference() {
    }

    BodyCircumference(BodyEvaluationVersion evaluationVersion, CircumferenceSite site, BigDecimal valueCm) {
        this.id = UUID.randomUUID();
        this.evaluationVersion = evaluationVersion;
        this.site = site;
        this.valueCm = valueCm.setScale(3, RoundingMode.HALF_UP);
    }

    UUID id() { return id; }
    CircumferenceSite site() { return site; }
    BigDecimal valueCm() { return valueCm; }
}

@Entity
@Table(name = "body_skinfolds")
class BodySkinfold {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "evaluation_version_id", nullable = false, updatable = false)
    private BodyEvaluationVersion evaluationVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24, updatable = false)
    private SkinfoldSite site;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16, updatable = false)
    private MeasurementSide side;

    @Column(name = "value_mm", nullable = false, precision = 8, scale = 3, updatable = false)
    private BigDecimal valueMm;

    protected BodySkinfold() {
    }

    BodySkinfold(
            BodyEvaluationVersion evaluationVersion,
            SkinfoldSite site,
            MeasurementSide side,
            BigDecimal valueMm) {
        this.id = UUID.randomUUID();
        this.evaluationVersion = evaluationVersion;
        this.site = site;
        this.side = side;
        this.valueMm = valueMm.setScale(3, RoundingMode.HALF_UP);
    }

    UUID id() { return id; }
    SkinfoldSite site() { return site; }
    MeasurementSide side() { return side; }
    BigDecimal valueMm() { return valueMm; }
}

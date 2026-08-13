package dev.formetric.body;

import dev.formetric.identity.FormulaSex;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/body-evaluations")
@Tag(name = "Body evaluations", description = "Immutable body-composition snapshots and method-aware comparisons")
@Validated
class BodyEvaluationController {

    private final BodyEvaluationService service;

    BodyEvaluationController(BodyEvaluationService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List current body-evaluation snapshots")
    BodyEvaluationPageResponse list(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "ACTIVE") BodyEvaluationArchiveStatus archiveStatus,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.list(from, to, archiveStatus, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create an evaluation and its immutable first version")
    BodyEvaluationDetailResponse create(@Valid @RequestBody CreateBodyEvaluationRequest request) {
        return service.create(request.toDefinition());
    }

    @GetMapping("/comparison")
    @Operation(
            summary = "Compare two immutable evaluation versions",
            description = "Deltas are follow-up minus baseline. Missing values remain null and method changes are explicit.")
    BodyEvaluationComparisonResponse compare(
            @RequestParam UUID baselineVersionId,
            @RequestParam UUID followUpVersionId) {
        return service.compare(baselineVersionId, followUpVersionId);
    }

    @GetMapping("/{evaluationId}")
    @ApiResponse(responseCode = "404", description = "Evaluation does not exist for the authenticated user")
    BodyEvaluationDetailResponse get(@PathVariable UUID evaluationId) {
        return service.get(evaluationId);
    }

    @PostMapping("/{evaluationId}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Append a complete immutable correction snapshot")
    BodyEvaluationDetailResponse createVersion(
            @PathVariable UUID evaluationId,
            @Valid @RequestBody CreateBodyEvaluationVersionRequest request) {
        return service.addVersion(evaluationId, request.expectedCurrentVersionNumber(), request.toDefinition());
    }

    @PostMapping("/{evaluationId}/archive")
    @Operation(summary = "Archive an evaluation while preserving every version")
    BodyEvaluationDetailResponse archive(
            @PathVariable UUID evaluationId,
            @Valid @RequestBody ChangeBodyEvaluationArchiveRequest request) {
        return service.setArchived(evaluationId, true, request.expectedIdentityVersion());
    }

    @DeleteMapping("/{evaluationId}/archive")
    @Operation(summary = "Restore an archived evaluation")
    BodyEvaluationDetailResponse restore(
            @PathVariable UUID evaluationId,
            @Valid @RequestBody ChangeBodyEvaluationArchiveRequest request) {
        return service.setArchived(evaluationId, false, request.expectedIdentityVersion());
    }
}

interface BodyEvaluationVersionPayload {
    LocalDate assessmentDate();
    String title();
    BodyEvaluationSource source();
    String assessorName();
    String notes();
    BigDecimal weightKg();
    BigDecimal heightCm();
    Integer ageYears();
    FormulaSex formulaSex();
    BodyCompositionProtocol protocol();
    ReportedMethodType reportedMethodType();
    String reportedMethodLabel();
    List<CircumferenceRequest> circumferences();
    List<SkinfoldRequest> skinfolds();
    List<ReportedBodyResultRequest> reportedResults();

    default BodyEvaluationVersionDefinition toDefinition() {
        return new BodyEvaluationVersionDefinition(
                assessmentDate(), title(), source(), assessorName(), notes(), weightKg(), heightCm(), ageYears(),
                formulaSex(), protocol(), reportedMethodType(), reportedMethodLabel(),
                circumferences().stream().map(CircumferenceRequest::toValue).toList(),
                skinfolds().stream().map(SkinfoldRequest::toValue).toList(),
                reportedResults().stream().map(ReportedBodyResultRequest::toValue).toList());
    }
}

record CreateBodyEvaluationRequest(
        @NotNull LocalDate assessmentDate,
        @NotBlank @Size(max = 160) String title,
        @NotNull BodyEvaluationSource source,
        @Size(max = 160) String assessorName,
        @Size(max = 2000) String notes,
        @DecimalMin(value = "0", inclusive = false) @DecimalMax("1000") @Digits(integer = 4, fraction = 3)
        BigDecimal weightKg,
        @DecimalMin("30") @DecimalMax("300") @Digits(integer = 3, fraction = 3)
        BigDecimal heightCm,
        @Min(0) @Max(130) Integer ageYears,
        FormulaSex formulaSex,
        @NotNull BodyCompositionProtocol protocol,
        @NotNull ReportedMethodType reportedMethodType,
        @Size(max = 160) String reportedMethodLabel,
        @NotNull @Size(max = 12) @Valid List<CircumferenceRequest> circumferences,
        @NotNull @Size(max = 7) @Valid List<SkinfoldRequest> skinfolds,
        @NotNull @Size(max = 13) @Valid List<ReportedBodyResultRequest> reportedResults)
        implements BodyEvaluationVersionPayload {
}

record CreateBodyEvaluationVersionRequest(
        @NotNull @Min(1) Integer expectedCurrentVersionNumber,
        @NotNull LocalDate assessmentDate,
        @NotBlank @Size(max = 160) String title,
        @NotNull BodyEvaluationSource source,
        @Size(max = 160) String assessorName,
        @Size(max = 2000) String notes,
        @DecimalMin(value = "0", inclusive = false) @DecimalMax("1000") @Digits(integer = 4, fraction = 3)
        BigDecimal weightKg,
        @DecimalMin("30") @DecimalMax("300") @Digits(integer = 3, fraction = 3)
        BigDecimal heightCm,
        @Min(0) @Max(130) Integer ageYears,
        FormulaSex formulaSex,
        @NotNull BodyCompositionProtocol protocol,
        @NotNull ReportedMethodType reportedMethodType,
        @Size(max = 160) String reportedMethodLabel,
        @NotNull @Size(max = 12) @Valid List<CircumferenceRequest> circumferences,
        @NotNull @Size(max = 7) @Valid List<SkinfoldRequest> skinfolds,
        @NotNull @Size(max = 13) @Valid List<ReportedBodyResultRequest> reportedResults)
        implements BodyEvaluationVersionPayload {
}

record CircumferenceRequest(
        @NotNull CircumferenceSite site,
        @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("1000")
        @Digits(integer = 4, fraction = 3) BigDecimal valueCm) {
    BodyCircumferenceValue toValue() {
        return new BodyCircumferenceValue(site, valueCm);
    }
}

record SkinfoldRequest(
        @NotNull SkinfoldSite site,
        @NotNull MeasurementSide side,
        @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("200")
        @Digits(integer = 3, fraction = 3) BigDecimal valueMm) {
    BodySkinfoldValue toValue() {
        return new BodySkinfoldValue(site, side, valueMm);
    }
}

record ReportedBodyResultRequest(
        @NotNull BodyResultMetric metric,
        @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 8) BigDecimal value,
        @Size(max = 160) String reportedLabel) {
    ReportedBodyResultValue toValue() {
        return new ReportedBodyResultValue(metric, value, reportedLabel);
    }
}

record ChangeBodyEvaluationArchiveRequest(@NotNull @Min(0) Long expectedIdentityVersion) {
}

record BodyEvaluationPageResponse(
        List<BodyEvaluationSummaryResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {
}

record BodyEvaluationSummaryResponse(
        UUID id,
        boolean archived,
        BodyEvaluationVersionResponse currentVersion,
        Instant createdAt,
        Instant updatedAt,
        long identityVersion) {

    static BodyEvaluationSummaryResponse from(BodyEvaluation evaluation, BodyEvaluationVersion currentVersion) {
        return new BodyEvaluationSummaryResponse(
                evaluation.id(), evaluation.archived(), BodyEvaluationVersionResponse.from(currentVersion),
                evaluation.createdAt(), evaluation.updatedAt(), evaluation.identityVersion());
    }
}

record BodyEvaluationDetailResponse(
        UUID id,
        boolean archived,
        BodyEvaluationVersionResponse currentVersion,
        Instant createdAt,
        Instant updatedAt,
        long identityVersion,
        List<BodyEvaluationVersionResponse> versions) {

    static BodyEvaluationDetailResponse from(
            BodyEvaluation evaluation,
            List<BodyEvaluationVersion> versions) {
        BodyEvaluationVersion current = versions.stream()
                .filter(version -> version.versionNumber() == evaluation.currentVersionNumber())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("A avaliação não possui sua versão atual."));
        return new BodyEvaluationDetailResponse(
                evaluation.id(), evaluation.archived(), BodyEvaluationVersionResponse.from(current),
                evaluation.createdAt(), evaluation.updatedAt(), evaluation.identityVersion(),
                versions.stream().map(BodyEvaluationVersionResponse::from).toList());
    }
}

record BodyEvaluationVersionResponse(
        UUID id,
        int versionNumber,
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
        Integer protocolRevision,
        ReportedMethodType reportedMethodType,
        String reportedMethodLabel,
        List<CircumferenceResponse> circumferences,
        List<SkinfoldResponse> skinfolds,
        List<BodyResultResponse> results,
        List<BodyWarningResponse> warnings,
        Instant createdAt) {

    static BodyEvaluationVersionResponse from(BodyEvaluationVersion version) {
        BodyCalculationOutcome calculation = BodyEvaluationService.recalculate(version);
        return new BodyEvaluationVersionResponse(
                version.id(), version.versionNumber(), version.assessmentDate(), version.title(), version.source(),
                version.assessorName(), version.notes(), version.weightKg(), version.heightCm(), version.ageYears(),
                version.formulaSex(), version.protocol(), version.protocolRevision(), version.reportedMethodType(),
                version.reportedMethodLabel(),
                version.circumferences().stream().map(CircumferenceResponse::from).toList(),
                version.skinfolds().stream().map(SkinfoldResponse::from).toList(),
                version.results().stream().map(BodyResultResponse::from).toList(),
                calculation.warnings().stream().map(BodyWarningResponse::from).toList(),
                version.createdAt());
    }
}

record CircumferenceResponse(CircumferenceSite site, BigDecimal valueCm) {
    static CircumferenceResponse from(BodyCircumference value) {
        return new CircumferenceResponse(value.site(), value.valueCm());
    }
}

record SkinfoldResponse(SkinfoldSite site, MeasurementSide side, BigDecimal valueMm) {
    static SkinfoldResponse from(BodySkinfold value) {
        return new SkinfoldResponse(value.site(), value.side(), value.valueMm());
    }
}

record BodyResultResponse(
        UUID id,
        BodyResultMetric metric,
        BigDecimal value,
        BodyResultProvenance provenance,
        String methodCode,
        int methodRevision,
        String reportedLabel,
        UUID basisResultId) {
    static BodyResultResponse from(BodyCompositionResult result) {
        return new BodyResultResponse(
                result.id(), result.metric(), result.value(), result.provenance(), result.methodCode(),
                result.methodRevision(), result.reportedLabel(), result.basisResultId());
    }
}

record BodyWarningResponse(String code, String message) {
    static BodyWarningResponse from(BodyCalculationWarning warning) {
        return new BodyWarningResponse(warning.code().name(), warning.message());
    }
}

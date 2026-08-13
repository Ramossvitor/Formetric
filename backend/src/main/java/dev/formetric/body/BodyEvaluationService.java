package dev.formetric.body;

import dev.formetric.identity.CurrentUserProvider;
import java.math.BigDecimal;
import java.math.MathContext;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class BodyEvaluationService {

    private static final MathContext MATH_CONTEXT = MathContext.DECIMAL128;
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final BodyEvaluationRepository evaluations;
    private final BodyEvaluationVersionRepository evaluationVersions;
    private final CurrentUserProvider currentUserProvider;
    private final Clock clock;

    BodyEvaluationService(
            BodyEvaluationRepository evaluations,
            BodyEvaluationVersionRepository evaluationVersions,
            CurrentUserProvider currentUserProvider,
            Clock clock) {
        this.evaluations = evaluations;
        this.evaluationVersions = evaluationVersions;
        this.currentUserProvider = currentUserProvider;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    BodyEvaluationPageResponse list(
            LocalDate from,
            LocalDate to,
            BodyEvaluationArchiveStatus archiveStatus,
            int page,
            int size) {
        validateRange(from, to);
        if (archiveStatus == null) {
            throw new BodyValidationException("archiveStatus", "O filtro de arquivamento é obrigatório.");
        }
        UUID userId = userId();
        Page<BodyEvaluation> result = evaluations.findPage(
                userId, from, to, archiveStatus == BodyEvaluationArchiveStatus.ALL,
                archiveStatus == BodyEvaluationArchiveStatus.ARCHIVED, PageRequest.of(page, size));
        List<UUID> ids = result.getContent().stream().map(BodyEvaluation::id).toList();
        Map<UUID, BodyEvaluationVersion> currentVersions = ids.isEmpty()
                ? Map.of()
                : evaluationVersions.findCurrentByEvaluationIds(ids).stream()
                        .collect(Collectors.toMap(version -> version.evaluation().id(), Function.identity()));
        currentVersions.values().forEach(BodyEvaluationService::initializeSnapshot);
        List<BodyEvaluationSummaryResponse> content = result.getContent().stream()
                .map(evaluation -> BodyEvaluationSummaryResponse.from(
                        evaluation,
                        requireCurrentVersion(currentVersions, evaluation.id())))
                .toList();
        return new BodyEvaluationPageResponse(
                content, result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    BodyEvaluationDetailResponse get(UUID evaluationId) {
        UUID userId = userId();
        BodyEvaluation evaluation = requireEvaluation(evaluationId, userId);
        return detail(evaluation, userId);
    }

    @Transactional
    BodyEvaluationDetailResponse create(BodyEvaluationVersionDefinition rawDefinition) {
        UUID userId = userId();
        BodyEvaluationVersionDefinition definition = normalizeAndValidate(rawDefinition);
        var now = clock.instant();
        BodyEvaluation evaluation = BodyEvaluation.create(userId, now);
        BodyEvaluationVersion evaluationVersion = buildVersion(evaluation, 1, definition, now);
        evaluation.addInitialVersion(evaluationVersion);
        try {
            evaluations.saveAndFlush(evaluation);
            return BodyEvaluationDetailResponse.from(evaluation, List.of(evaluationVersion));
        } catch (DataIntegrityViolationException exception) {
            throw new BodyConflictException("Não foi possível criar a avaliação corporal.", exception);
        }
    }

    @Transactional
    BodyEvaluationDetailResponse addVersion(
            UUID evaluationId,
            int expectedCurrentVersionNumber,
            BodyEvaluationVersionDefinition rawDefinition) {
        UUID userId = userId();
        BodyEvaluationVersionDefinition definition = normalizeAndValidate(rawDefinition);
        BodyEvaluation evaluation = evaluations.findOwnedByIdForUpdate(evaluationId, userId)
                .orElseThrow(() -> new BodyNotFoundException("Avaliação corporal não encontrada."));
        var now = clock.instant();
        BodyEvaluationVersion evaluationVersion = buildVersion(
                evaluation, evaluation.currentVersionNumber() + 1, definition, now);
        evaluation.addVersion(evaluationVersion, expectedCurrentVersionNumber, now);
        try {
            evaluations.saveAndFlush(evaluation);
            return detail(evaluation, userId);
        } catch (DataIntegrityViolationException | ObjectOptimisticLockingFailureException exception) {
            throw new BodyConflictException(
                    "A avaliação foi alterada por outra operação. Atualize os dados e tente novamente.", exception);
        }
    }

    @Transactional
    BodyEvaluationDetailResponse setArchived(
            UUID evaluationId,
            boolean archived,
            long expectedIdentityVersion) {
        UUID userId = userId();
        BodyEvaluation evaluation = evaluations.findOwnedByIdForUpdate(evaluationId, userId)
                .orElseThrow(() -> new BodyNotFoundException("Avaliação corporal não encontrada."));
        evaluation.setArchived(archived, expectedIdentityVersion, clock.instant());
        try {
            evaluations.saveAndFlush(evaluation);
            return detail(evaluation, userId);
        } catch (ObjectOptimisticLockingFailureException exception) {
            throw new BodyConflictException(
                    "A avaliação foi alterada por outra operação. Atualize os dados e tente novamente.", exception);
        }
    }

    @Transactional(readOnly = true)
    BodyEvaluationComparisonResponse compare(UUID baselineVersionId, UUID followUpVersionId) {
        UUID userId = userId();
        BodyEvaluationVersion baseline = requireVersion(baselineVersionId, userId);
        BodyEvaluationVersion followUp = requireVersion(followUpVersionId, userId);
        if (baselineVersionId.equals(followUpVersionId)) {
            throw new BodyValidationException(
                    "followUpVersionId", "Selecione duas versões diferentes para comparar.");
        }
        if (followUp.assessmentDate().isBefore(baseline.assessmentDate())) {
            throw new BodyValidationException(
                    "followUpVersionId",
                    "A avaliação final não pode ser anterior à avaliação inicial.");
        }
        initializeSnapshot(baseline);
        initializeSnapshot(followUp);
        return BodyComparison.compare(baseline, followUp);
    }

    private BodyEvaluationDetailResponse detail(BodyEvaluation evaluation, UUID userId) {
        List<BodyEvaluationVersion> versions = evaluationVersions.findAllOwnedVersions(evaluation.id(), userId);
        versions.forEach(BodyEvaluationService::initializeSnapshot);
        return BodyEvaluationDetailResponse.from(evaluation, versions);
    }

    private BodyEvaluationVersion buildVersion(
            BodyEvaluation evaluation,
            int versionNumber,
            BodyEvaluationVersionDefinition definition,
            java.time.Instant now) {
        BodyCalculationOutcome calculation = BodyCalculations.calculate(toCalculationInput(definition));
        Integer protocolRevision = definition.protocol() == BodyCompositionProtocol.JACKSON_POLLOCK_7_SIRI_1961
                ? BodyCalculations.JACKSON_POLLOCK_7_SIRI_REVISION
                : null;
        BodyEvaluationVersion version = new BodyEvaluationVersion(
                evaluation, versionNumber, definition, protocolRevision, now);
        definition.circumferences().forEach(value -> version.addCircumference(value.site(), value.valueCm()));
        definition.skinfolds().forEach(value -> version.addSkinfold(value.site(), value.side(), value.valueMm()));
        calculation.results().forEach(result -> version.addResult(new BodyCompositionResult(
                version,
                result.metric(),
                result.value(),
                BodyResultProvenance.SYSTEM_CALCULATED,
                result.methodCode(),
                result.methodRevision(),
                null,
                null,
                now)));
        addReportedResults(version, definition, now);
        return version;
    }

    private static void addReportedResults(
            BodyEvaluationVersion version,
            BodyEvaluationVersionDefinition definition,
            java.time.Instant now) {
        String reportedMethodCode = "REPORTED_" + definition.reportedMethodType().name();
        for (ReportedBodyResultValue reported : definition.reportedResults()) {
            BodyCompositionResult result = new BodyCompositionResult(
                    version,
                    reported.metric(),
                    reported.value(),
                    BodyResultProvenance.REPORTED,
                    reportedMethodCode,
                    1,
                    reported.reportedLabel(),
                    null,
                    now);
            version.addResult(result);
            if (reported.metric() == BodyResultMetric.BODY_FAT_PERCENT && definition.weightKg() != null) {
                BigDecimal fatMass = definition.weightKg()
                        .multiply(reported.value(), MATH_CONTEXT)
                        .divide(ONE_HUNDRED, MATH_CONTEXT);
                version.addResult(new BodyCompositionResult(
                        version,
                        BodyResultMetric.FAT_MASS_KG,
                        fatMass,
                        BodyResultProvenance.SYSTEM_DERIVED_FROM_REPORTED,
                        "BODY_FAT_PERCENT_TO_MASS",
                        1,
                        null,
                        result,
                        now));
                version.addResult(new BodyCompositionResult(
                        version,
                        BodyResultMetric.FAT_FREE_MASS_KG,
                        definition.weightKg().subtract(fatMass, MATH_CONTEXT),
                        BodyResultProvenance.SYSTEM_DERIVED_FROM_REPORTED,
                        "BODY_FAT_PERCENT_TO_MASS",
                        1,
                        null,
                        result,
                        now));
            }
        }
    }

    private static BodyEvaluationVersionDefinition normalizeAndValidate(BodyEvaluationVersionDefinition definition) {
        if (definition == null) {
            throw new BodyValidationException("evaluation", "Os dados da avaliação são obrigatórios.");
        }
        if (definition.assessmentDate() == null) {
            throw new BodyValidationException("assessmentDate", "A data da avaliação é obrigatória.");
        }
        String title = requiredTrimmed(definition.title(), "title", "O título é obrigatório.", 160);
        if (definition.source() == null) {
            throw new BodyValidationException("source", "A origem da avaliação é obrigatória.");
        }
        if (definition.protocol() == null) {
            throw new BodyValidationException("protocol", "O protocolo é obrigatório.");
        }
        if (definition.reportedMethodType() == null) {
            throw new BodyValidationException("reportedMethodType", "O método informado é obrigatório.");
        }
        String assessorName = optionalTrimmed(definition.assessorName(), "assessorName", 160);
        String notes = optionalPreservingWhitespace(definition.notes(), "notes", 2000);
        String reportedMethodLabel = optionalTrimmed(
                definition.reportedMethodLabel(), "reportedMethodLabel", 160);
        if (definition.reportedMethodType() == ReportedMethodType.OTHER && reportedMethodLabel == null) {
            throw new BodyValidationException(
                    "reportedMethodLabel", "Descreva o método quando o tipo selecionado for OTHER.");
        }

        List<BodyCircumferenceValue> circumferences = definition.circumferences() == null
                ? List.of()
                : List.copyOf(definition.circumferences());
        List<BodySkinfoldValue> skinfolds = definition.skinfolds() == null
                ? List.of()
                : List.copyOf(definition.skinfolds());
        validateStoragePrecision(definition.weightKg(), 3, "weightKg");
        validateStoragePrecision(definition.heightCm(), 3, "heightCm");
        circumferences.forEach(value -> validateStoragePrecision(
                value == null ? null : value.valueCm(), 3, "circumferences"));
        skinfolds.forEach(value -> validateStoragePrecision(
                value == null ? null : value.valueMm(), 3, "skinfolds"));
        List<ReportedBodyResultValue> reportedResults = normalizeReportedResults(definition.reportedResults());

        BodyCalculationInput calculationInput = new BodyCalculationInput(
                definition.weightKg(), definition.heightCm(), definition.ageYears(), definition.formulaSex(),
                definition.protocol(), circumferences, skinfolds);
        try {
            BodyCalculations.calculate(calculationInput);
        } catch (BodyCalculationException exception) {
            throw new BodyValidationException(exception.field(), exception.getMessage());
        }
        return new BodyEvaluationVersionDefinition(
                definition.assessmentDate(), title, definition.source(), assessorName, notes,
                definition.weightKg(), definition.heightCm(), definition.ageYears(), definition.formulaSex(),
                definition.protocol(), definition.reportedMethodType(), reportedMethodLabel,
                circumferences, skinfolds, reportedResults);
    }

    private static List<ReportedBodyResultValue> normalizeReportedResults(List<ReportedBodyResultValue> values) {
        List<ReportedBodyResultValue> safe = values == null ? List.of() : values;
        Set<BodyResultMetric> metrics = EnumSet.noneOf(BodyResultMetric.class);
        return safe.stream().map(value -> {
            if (value == null || value.metric() == null || value.value() == null) {
                throw new BodyValidationException(
                        "reportedResults", "Cada resultado informado deve possuir métrica e valor.");
            }
            if (!metrics.add(value.metric())) {
                throw new BodyValidationException(
                        "reportedResults", "Uma mesma métrica informada não pode se repetir.");
            }
            validateReportedValue(value.metric(), value.value());
            validateStoragePrecision(value.value(), 8, "reportedResults");
            return new ReportedBodyResultValue(
                    value.metric(), value.value(), optionalTrimmed(value.reportedLabel(), "reportedLabel", 160));
        }).toList();
    }

    private static void validateReportedValue(BodyResultMetric metric, BigDecimal value) {
        if (value.signum() < 0) {
            throw new BodyValidationException("reportedResults", "Resultados informados não podem ser negativos.");
        }
        if ((metric == BodyResultMetric.BODY_FAT_PERCENT
                || metric == BodyResultMetric.FAT_FREE_MASS_PERCENT)
                && value.compareTo(ONE_HUNDRED) > 0) {
            throw new BodyValidationException(
                    "reportedResults", "Resultados percentuais devem estar entre 0 e 100.");
        }
    }

    private static void validateStoragePrecision(BigDecimal value, int maximumScale, String field) {
        if (value != null && Math.max(0, value.stripTrailingZeros().scale()) > maximumScale) {
            throw new BodyValidationException(
                    field, "O valor possui mais de " + maximumScale + " casas decimais significativas.");
        }
    }

    private static BodyCalculationInput toCalculationInput(BodyEvaluationVersionDefinition definition) {
        return new BodyCalculationInput(
                definition.weightKg(), definition.heightCm(), definition.ageYears(), definition.formulaSex(),
                definition.protocol(), definition.circumferences(), definition.skinfolds());
    }

    static BodyCalculationOutcome recalculate(BodyEvaluationVersion version) {
        return BodyCalculations.calculate(new BodyCalculationInput(
                version.weightKg(), version.heightCm(), version.ageYears(), version.formulaSex(), version.protocol(),
                version.circumferences().stream()
                        .map(value -> new BodyCircumferenceValue(value.site(), value.valueCm())).toList(),
                version.skinfolds().stream()
                        .map(value -> new BodySkinfoldValue(value.site(), value.side(), value.valueMm())).toList()));
    }

    private static void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new BodyValidationException("from", "As datas inicial e final são obrigatórias.");
        }
        if (to.isBefore(from)) {
            throw new BodyValidationException("to", "A data final não pode ser anterior à data inicial.");
        }
        if (ChronoUnit.DAYS.between(from, to) > 3660) {
            throw new BodyValidationException("to", "O intervalo máximo para avaliações é de 10 anos.");
        }
    }

    private BodyEvaluation requireEvaluation(UUID evaluationId, UUID userId) {
        return evaluations.findByIdAndUserId(evaluationId, userId)
                .orElseThrow(() -> new BodyNotFoundException("Avaliação corporal não encontrada."));
    }

    private BodyEvaluationVersion requireVersion(UUID versionId, UUID userId) {
        return evaluationVersions.findOwnedVersion(versionId, userId)
                .orElseThrow(() -> new BodyNotFoundException("Versão de avaliação corporal não encontrada."));
    }

    private UUID userId() {
        return currentUserProvider.requireCurrentUser().id();
    }

    private static BodyEvaluationVersion requireCurrentVersion(
            Map<UUID, BodyEvaluationVersion> versions,
            UUID evaluationId) {
        BodyEvaluationVersion version = versions.get(evaluationId);
        if (version == null) {
            throw new IllegalStateException("A avaliação não possui sua versão atual.");
        }
        return version;
    }

    private static void initializeSnapshot(BodyEvaluationVersion version) {
        version.circumferences().size();
        version.skinfolds().size();
        version.results().size();
    }

    private static String requiredTrimmed(String value, String field, String message, int maximum) {
        if (value == null || value.strip().isEmpty()) {
            throw new BodyValidationException(field, message);
        }
        String result = value.strip();
        if (result.length() > maximum) {
            throw new BodyValidationException(field, "O campo excede " + maximum + " caracteres.");
        }
        return result;
    }

    private static String optionalTrimmed(String value, String field, int maximum) {
        if (value == null || value.strip().isEmpty()) {
            return null;
        }
        String result = value.strip();
        if (result.length() > maximum) {
            throw new BodyValidationException(field, "O campo excede " + maximum + " caracteres.");
        }
        return result;
    }

    private static String optionalPreservingWhitespace(String value, String field, int maximum) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.length() > maximum) {
            throw new BodyValidationException(field, "O campo excede " + maximum + " caracteres.");
        }
        return value;
    }
}

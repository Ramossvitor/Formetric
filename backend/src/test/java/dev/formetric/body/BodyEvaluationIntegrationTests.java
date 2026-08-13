package dev.formetric.body;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import dev.formetric.TestcontainersConfiguration;
import dev.formetric.identity.AuthenticatedUser;
import dev.formetric.identity.CurrentUserProvider;
import dev.formetric.identity.FormulaSex;
import dev.formetric.identity.UserRole;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(TestcontainersConfiguration.class)
class BodyEvaluationIntegrationTests {

    private static final UUID USER_ONE = UUID.fromString("51000000-0000-0000-0000-000000000001");
    private static final UUID USER_TWO = UUID.fromString("52000000-0000-0000-0000-000000000002");

    @Autowired
    private BodyEvaluationService service;

    @Autowired
    private BodyDataProvider dataProvider;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @MockitoBean
    private CurrentUserProvider currentUserProvider;

    @BeforeEach
    void prepareUsers() {
        jdbcTemplate.update("DELETE FROM user_accounts");
        createUser(USER_ONE, "body-one@example.test");
        createUser(USER_TWO, "body-two@example.test");
        authenticate(USER_ONE);
    }

    @Test
    void versionsAreAppendOnlyAndReportedResultsCoexistWithCalculatedAndDerivedResults() {
        BodyEvaluationDetailResponse created = service.create(definition(
                "2026-07-10", "Avaliação inicial", FormulaSex.MALE, BodyCompositionProtocol.NONE,
                List.of(
                        circumference(CircumferenceSite.WAIST, "90"),
                        circumference(CircumferenceSite.HIP, "100")),
                List.of(),
                List.of(reported(BodyResultMetric.BODY_FAT_PERCENT, "20", "BIA clínica"))));

        assertThat(created.currentVersion().results())
                .extracting(BodyResultResponse::provenance)
                .contains(
                        BodyResultProvenance.REPORTED,
                        BodyResultProvenance.SYSTEM_CALCULATED,
                        BodyResultProvenance.SYSTEM_DERIVED_FROM_REPORTED);
        BodyResultResponse reportedFat = result(
                created.currentVersion(), BodyResultMetric.BODY_FAT_PERCENT, BodyResultProvenance.REPORTED);
        BodyResultResponse derivedFatMass = result(
                created.currentVersion(), BodyResultMetric.FAT_MASS_KG,
                BodyResultProvenance.SYSTEM_DERIVED_FROM_REPORTED);
        assertThat(derivedFatMass.value()).isEqualByComparingTo("18.00000000");
        assertThat(derivedFatMass.basisResultId()).isEqualTo(reportedFat.id());

        BodyEvaluationDetailResponse corrected = service.addVersion(
                created.id(),
                1,
                definition(
                        "2026-08-10", "Avaliação corrigida", FormulaSex.MALE, BodyCompositionProtocol.NONE,
                        List.of(
                                circumference(CircumferenceSite.WAIST, "86"),
                                circumference(CircumferenceSite.HIP, "98")),
                        List.of(),
                        List.of(reported(BodyResultMetric.BODY_FAT_PERCENT, "18", "BIA clínica"))));

        assertThat(corrected.versions()).extracting(BodyEvaluationVersionResponse::versionNumber)
                .containsExactly(2, 1);
        assertThat(corrected.versions().get(1).title()).isEqualTo("Avaliação inicial");
        assertThrows(BodyConflictException.class, () -> service.addVersion(
                created.id(), 1, definition(
                        "2026-08-11", "Versão obsoleta", FormulaSex.MALE, BodyCompositionProtocol.NONE,
                        List.of(), List.of(), List.of())));

        BodyEvaluationDetailResponse archived = service.setArchived(
                corrected.id(), true, corrected.identityVersion());
        assertThat(archived.archived()).isTrue();
        assertThrows(BodyConflictException.class, () -> service.setArchived(
                corrected.id(), false, corrected.identityVersion()));
        assertThat(service.list(
                LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31"),
                BodyEvaluationArchiveStatus.ACTIVE, 0, 20).content()).isEmpty();
        assertThat(service.list(
                LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31"),
                BodyEvaluationArchiveStatus.ARCHIVED, 0, 20).content()).hasSize(1);
    }

    @Test
    void comparisonIsMethodAwareNeverInventsMissingValuesAndUsesImmutableVersionIds() {
        BodyEvaluationDetailResponse baseline = service.create(definition(
                "2026-06-01", "Base", FormulaSex.MALE, BodyCompositionProtocol.JACKSON_POLLOCK_7_SIRI_1961,
                List.of(circumference(CircumferenceSite.WAIST, "90")),
                sevenSkinfolds("20", MeasurementSide.RIGHT),
                List.of(reported(BodyResultMetric.BODY_FAT_PERCENT, "21", "Aparelho A"))));
        BodyEvaluationDetailResponse followUp = service.create(definition(
                "2026-07-01", "Retorno", FormulaSex.FEMALE, BodyCompositionProtocol.JACKSON_POLLOCK_7_SIRI_1961,
                List.of(circumference(CircumferenceSite.WAIST, "87")),
                sevenSkinfolds("18", MeasurementSide.RIGHT),
                List.of(reported(BodyResultMetric.BODY_FAT_PERCENT, "19", "Aparelho A"))));

        BodyEvaluationComparisonResponse comparison = service.compare(
                baseline.currentVersion().id(), followUp.currentVersion().id());
        assertThat(comparison.daysBetween()).isEqualTo(30);
        assertThat(comparison.weightDeltaKg()).isEqualByComparingTo("0.000");
        assertThat(delta(comparison, BodyResultMetric.BODY_FAT_PERCENT, BodyResultProvenance.REPORTED)
                .compatibility()).isEqualTo(BodyComparisonCompatibility.SAME_METHOD);
        assertThat(delta(comparison, BodyResultMetric.BODY_FAT_PERCENT, BodyResultProvenance.SYSTEM_CALCULATED)
                .compatibility()).isEqualTo(BodyComparisonCompatibility.METHOD_CHANGED);
        assertThat(delta(comparison, BodyResultMetric.BODY_FAT_PERCENT, BodyResultProvenance.SYSTEM_CALCULATED)
                .delta()).isNotNull();
        assertThat(comparison.circumferenceSumDeltaCm()).isEqualByComparingTo("-3.000");
        assertThat(comparison.skinfoldSumDeltaMm()).isEqualByComparingTo("-14.000");

        BodyEvaluationDetailResponse partial = service.create(definition(
                "2026-07-10", "Parcial", null, BodyCompositionProtocol.NONE,
                List.of(),
                sevenSkinfolds("10", MeasurementSide.RIGHT).subList(0, 3),
                List.of()));
        BodyEvaluationDetailResponse partialNext = service.addVersion(
                partial.id(), 1, definition(
                        "2026-07-20", "Parcial 2", null, BodyCompositionProtocol.NONE,
                        List.of(),
                        sevenSkinfolds("11", MeasurementSide.LEFT).subList(0, 3),
                        List.of()));
        BodyEvaluationComparisonResponse partialComparison = service.compare(
                partial.versions().getFirst().id(), partialNext.currentVersion().id());
        assertThat(partialComparison.circumferenceSumDeltaCm()).isNull();
        assertThat(partialComparison.skinfoldSumDeltaMm()).isNull();
        assertThat(partialComparison.skinfoldDeltas()).hasSize(6).allSatisfy(value -> {
            assertThat(value.deltaMm()).isNull();
            assertThat(value.baselineValueMm() == null || value.followUpValueMm() == null).isTrue();
        });

        assertThrows(BodyValidationException.class, () -> service.compare(
                followUp.currentVersion().id(), baseline.currentVersion().id()));
        assertThrows(BodyValidationException.class, () -> service.compare(
                baseline.currentVersion().id(), baseline.currentVersion().id()));
    }

    @Test
    void userIsolationAppliesToDetailsVersionsComparisonsAndAnalyticsProvider() {
        BodyEvaluationDetailResponse created = service.create(definition(
                "2026-08-01", "Privada", FormulaSex.MALE, BodyCompositionProtocol.NONE,
                List.of(circumference(CircumferenceSite.WAIST, "82")), List.of(), List.of()));

        assertThat(dataProvider.currentEvaluations(
                LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31"))).hasSize(1);
        authenticate(USER_TWO);
        assertThrows(BodyNotFoundException.class, () -> service.get(created.id()));
        assertThrows(BodyNotFoundException.class, () -> service.addVersion(
                created.id(), 1, definition(
                        "2026-08-02", "Intrusão", null, BodyCompositionProtocol.NONE,
                        List.of(), List.of(), List.of())));
        assertThrows(BodyNotFoundException.class, () -> service.compare(
                created.currentVersion().id(), created.currentVersion().id()));
        assertThat(dataProvider.currentEvaluations(
                LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31"))).isEmpty();
    }

    @Test
    void duplicateReportedMetricsAndUnsafeStoragePrecisionAreRejectedBeforePersistence() {
        BodyEvaluationVersionDefinition duplicate = definition(
                "2026-08-01", "Duplicada", null, BodyCompositionProtocol.NONE,
                List.of(), List.of(),
                List.of(
                        reported(BodyResultMetric.BODY_FAT_PERCENT, "20", null),
                        reported(BodyResultMetric.BODY_FAT_PERCENT, "21", null)));
        assertThat(assertThrows(BodyValidationException.class, () -> service.create(duplicate)).field())
                .isEqualTo("reportedResults");

        BodyEvaluationVersionDefinition tooPrecise = definition(
                "2026-08-01", "Precisão", null, BodyCompositionProtocol.NONE,
                List.of(circumference(CircumferenceSite.WAIST, "0.0004")), List.of(), List.of());
        assertThat(assertThrows(BodyValidationException.class, () -> service.create(tooPrecise)).field())
                .isEqualTo("circumferences");
    }

    @Test
    void partialSnapshotsRemainPartialAndPagedListingLoadsItsBatchWithoutNPlusOneQueries() {
        BodyEvaluationVersionDefinition partial = new BodyEvaluationVersionDefinition(
                LocalDate.parse("2026-05-01"), "Snapshot parcial", BodyEvaluationSource.SELF,
                null, null, null, null, null, null, BodyCompositionProtocol.NONE,
                ReportedMethodType.UNSPECIFIED, null, List.of(), List.of(), List.of());
        BodyEvaluationDetailResponse created = service.create(partial);
        assertThat(created.currentVersion().weightKg()).isNull();
        assertThat(created.currentVersion().results()).isEmpty();

        for (int index = 2; index <= 6; index++) {
            service.create(new BodyEvaluationVersionDefinition(
                    LocalDate.of(2026, 5, index), "Snapshot " + index, BodyEvaluationSource.SELF,
                    null, null, null, null, null, null, BodyCompositionProtocol.NONE,
                    ReportedMethodType.UNSPECIFIED, null,
                    List.of(circumference(CircumferenceSite.WAIST, Integer.toString(80 + index))),
                    List.of(), List.of()));
        }

        var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        BodyEvaluationPageResponse page = service.list(
                LocalDate.parse("2026-05-01"), LocalDate.parse("2026-05-31"),
                BodyEvaluationArchiveStatus.ACTIVE, 0, 20);

        assertThat(page.content()).hasSize(6);
        assertThat(statistics.getPrepareStatementCount())
                .as("page, count, current versions and three batch collection reads")
                .isLessThanOrEqualTo(7);
    }

    @Test
    void rawMeasurementSignaturesAffectOnlyCalculatedAggregateAndProtocolComparability() {
        BodyEvaluationDetailResponse baseline = service.create(definition(
                "2026-04-01", "Direita", FormulaSex.MALE, BodyCompositionProtocol.JACKSON_POLLOCK_7_SIRI_1961,
                List.of(circumference(CircumferenceSite.WAIST, "90")),
                sevenSkinfolds("20", MeasurementSide.RIGHT),
                List.of(reported(BodyResultMetric.SKINFOLD_SUM_MM, "140", "Laudo"))));
        BodyEvaluationDetailResponse followUp = service.create(definition(
                "2026-04-15", "Esquerda", FormulaSex.MALE, BodyCompositionProtocol.JACKSON_POLLOCK_7_SIRI_1961,
                List.of(
                        circumference(CircumferenceSite.WAIST, "88"),
                        circumference(CircumferenceSite.HIP, "98")),
                sevenSkinfolds("18", MeasurementSide.LEFT),
                List.of(reported(BodyResultMetric.SKINFOLD_SUM_MM, "126", "Laudo"))));

        BodyEvaluationComparisonResponse comparison = service.compare(
                baseline.currentVersion().id(), followUp.currentVersion().id());
        BodyResultDeltaResponse reportedSum = delta(
                comparison, BodyResultMetric.SKINFOLD_SUM_MM, BodyResultProvenance.REPORTED);
        BodyResultDeltaResponse calculatedFat = delta(
                comparison, BodyResultMetric.BODY_FAT_PERCENT, BodyResultProvenance.SYSTEM_CALCULATED);
        BodyResultDeltaResponse calculatedCircumferenceSum = delta(
                comparison, BodyResultMetric.CIRCUMFERENCE_SUM_CM, BodyResultProvenance.SYSTEM_CALCULATED);

        assertThat(reportedSum.compatibility()).isEqualTo(BodyComparisonCompatibility.SAME_METHOD);
        assertThat(reportedSum.delta()).isEqualByComparingTo("-14.00000000");
        assertThat(calculatedFat.compatibility()).isEqualTo(BodyComparisonCompatibility.METHOD_CHANGED);
        assertThat(calculatedFat.delta()).isNotNull();
        assertThat(calculatedCircumferenceSum.compatibility())
                .isEqualTo(BodyComparisonCompatibility.METHOD_CHANGED);
        assertThat(calculatedCircumferenceSum.delta()).isNull();
    }

    private static BodyEvaluationVersionDefinition definition(
            String date,
            String title,
            FormulaSex formulaSex,
            BodyCompositionProtocol protocol,
            List<BodyCircumferenceValue> circumferences,
            List<BodySkinfoldValue> skinfolds,
            List<ReportedBodyResultValue> reportedResults) {
        return new BodyEvaluationVersionDefinition(
                LocalDate.parse(date), title, BodyEvaluationSource.PROFESSIONAL, "Profissional", null,
                new BigDecimal("90"), new BigDecimal("180"), 30, formulaSex, protocol,
                ReportedMethodType.BIOIMPEDANCE, "Aparelho X", circumferences, skinfolds, reportedResults);
    }

    private static BodyCircumferenceValue circumference(CircumferenceSite site, String value) {
        return new BodyCircumferenceValue(site, new BigDecimal(value));
    }

    private static ReportedBodyResultValue reported(BodyResultMetric metric, String value, String label) {
        return new ReportedBodyResultValue(metric, new BigDecimal(value), label);
    }

    private static List<BodySkinfoldValue> sevenSkinfolds(String value, MeasurementSide side) {
        BigDecimal measurement = new BigDecimal(value);
        return java.util.Arrays.stream(SkinfoldSite.values())
                .map(site -> new BodySkinfoldValue(site, side, measurement))
                .toList();
    }

    private static BodyResultResponse result(
            BodyEvaluationVersionResponse version,
            BodyResultMetric metric,
            BodyResultProvenance provenance) {
        return version.results().stream()
                .filter(value -> value.metric() == metric && value.provenance() == provenance)
                .findFirst().orElseThrow();
    }

    private static BodyResultDeltaResponse delta(
            BodyEvaluationComparisonResponse comparison,
            BodyResultMetric metric,
            BodyResultProvenance provenance) {
        return comparison.resultDeltas().stream()
                .filter(value -> value.metric() == metric && value.provenance() == provenance)
                .findFirst().orElseThrow();
    }

    private void authenticate(UUID userId) {
        when(currentUserProvider.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(userId, userId + "@example.test", "Body User", UserRole.USER));
    }

    private void createUser(UUID userId, String email) {
        jdbcTemplate.update("""
                INSERT INTO user_accounts
                    (id, email, password_hash, role, status, created_at, updated_at)
                VALUES (?, ?, 'test-only', 'USER', 'ACTIVE', now(), now())
                """, userId, email);
    }
}

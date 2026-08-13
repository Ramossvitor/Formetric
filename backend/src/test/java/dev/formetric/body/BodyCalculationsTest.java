package dev.formetric.body;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import dev.formetric.identity.FormulaSex;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class BodyCalculationsTest {

    @Test
    void jacksonPollockSevenMatchesPublishedMaleAndFemaleFixturesWithoutIntermediateRounding() {
        BodyCalculationOutcome male = BodyCalculations.calculate(jacksonPollockInput(FormulaSex.MALE, 30, "20"));
        BodyCalculationOutcome female = BodyCalculations.calculate(jacksonPollockInput(FormulaSex.FEMALE, 30, "20"));

        Map<BodyResultMetric, BigDecimal> maleResults = valuesByMetric(male);
        Map<BodyResultMetric, BigDecimal> femaleResults = valuesByMetric(female);
        assertThat(maleResults.get(BodyResultMetric.BODY_DENSITY_G_PER_ML))
                .isEqualByComparingTo("1.05323360");
        assertThat(maleResults.get(BodyResultMetric.BODY_FAT_PERCENT))
                .isEqualByComparingTo("19.98120835");
        assertThat(femaleResults.get(BodyResultMetric.BODY_DENSITY_G_PER_ML))
                .isEqualByComparingTo("1.03836820");
        assertThat(femaleResults.get(BodyResultMetric.BODY_FAT_PERCENT))
                .isEqualByComparingTo("26.70951402");
        assertThat(maleResults.get(BodyResultMetric.FAT_MASS_KG))
                .isEqualByComparingTo("17.98308751");
        assertThat(maleResults.get(BodyResultMetric.FAT_FREE_MASS_KG))
                .isEqualByComparingTo("72.01691249");
        assertThat(maleResults).containsKey(BodyResultMetric.FAT_FREE_MASS_PERCENT);
        assertThat(male.warnings()).isEmpty();
    }

    @Test
    void generalMetricsRemainAvailableForPartialEvaluationsWithoutInventingMissingValues() {
        BodyCalculationOutcome outcome = BodyCalculations.calculate(new BodyCalculationInput(
                new BigDecimal("89.8"),
                new BigDecimal("180"),
                null,
                null,
                BodyCompositionProtocol.NONE,
                List.of(
                        new BodyCircumferenceValue(CircumferenceSite.WAIST, new BigDecimal("82.4")),
                        new BodyCircumferenceValue(CircumferenceSite.HIP, new BigDecimal("98.2"))),
                List.of()));

        Map<BodyResultMetric, BigDecimal> results = valuesByMetric(outcome);
        assertThat(results.get(BodyResultMetric.BMI)).isEqualByComparingTo("27.71604938");
        assertThat(results.get(BodyResultMetric.WAIST_HIP_RATIO)).isEqualByComparingTo("0.83910387");
        assertThat(results.get(BodyResultMetric.CIRCUMFERENCE_SUM_CM)).isEqualByComparingTo("180.60000000");
        assertThat(results).doesNotContainKeys(
                BodyResultMetric.BODY_FAT_PERCENT,
                BodyResultMetric.FAT_MASS_KG,
                BodyResultMetric.FAT_FREE_MASS_KG);
    }

    @Test
    void protocolRequiresEveryUniqueSkinfoldAndRequiredFormulaSnapshots() {
        BodyCalculationInput missingFold = new BodyCalculationInput(
                null, null, 30, FormulaSex.MALE, BodyCompositionProtocol.JACKSON_POLLOCK_7_SIRI_1961,
                List.of(), jacksonPollockSkinfolds("20").subList(0, 6));
        BodyCalculationInput duplicateFold = new BodyCalculationInput(
                null, null, 30, FormulaSex.MALE, BodyCompositionProtocol.JACKSON_POLLOCK_7_SIRI_1961,
                List.of(), List.of(
                        new BodySkinfoldValue(SkinfoldSite.CHEST, MeasurementSide.RIGHT, new BigDecimal("10")),
                        new BodySkinfoldValue(SkinfoldSite.CHEST, MeasurementSide.LEFT, new BigDecimal("11"))));

        assertThat(assertThrows(BodyCalculationException.class, () -> BodyCalculations.calculate(missingFold)).field())
                .isEqualTo("skinfolds");
        assertThat(assertThrows(BodyCalculationException.class, () -> BodyCalculations.calculate(duplicateFold)).field())
                .isEqualTo("skinfolds");
        assertThat(assertThrows(BodyCalculationException.class, () -> BodyCalculations.calculate(
                new BodyCalculationInput(null, null, null, FormulaSex.MALE,
                        BodyCompositionProtocol.JACKSON_POLLOCK_7_SIRI_1961,
                        List.of(), jacksonPollockSkinfolds("20")))).field())
                .isEqualTo("ageYears");
    }

    @Test
    void extrapolatedResultsAreReturnedUnclampedWithExplicitWarnings() {
        BodyCalculationOutcome outcome = BodyCalculations.calculate(jacksonPollockInput(FormulaSex.MALE, 70, "50"));

        assertThat(outcome.warnings()).extracting(BodyCalculationWarning::code).containsExactly(
                BodyWarningCode.OUTSIDE_VALIDATED_AGE_RANGE,
                BodyWarningCode.MALE_SUM_OUTSIDE_REFERENCE_RANGE,
                BodyWarningCode.EXTRAPOLATED);
        assertThat(valuesByMetric(outcome).get(BodyResultMetric.BODY_FAT_PERCENT)).isNotNull();
    }

    @Test
    void femaleOverFortyRetainsTheCalculationAndAddsThePublishedCaution() {
        BodyCalculationOutcome outcome = BodyCalculations.calculate(jacksonPollockInput(FormulaSex.FEMALE, 45, "20"));

        assertThat(outcome.warnings()).extracting(BodyCalculationWarning::code)
                .containsExactly(BodyWarningCode.FEMALE_OVER_40_LIMITED_VALIDATION);
        assertThat(valuesByMetric(outcome)).containsKeys(
                BodyResultMetric.BODY_FAT_PERCENT,
                BodyResultMetric.FAT_FREE_MASS_KG);
    }

    @Test
    void heightBelowSafeStorageAndBmiRangeIsRejected() {
        BodyCalculationException exception = assertThrows(BodyCalculationException.class, () ->
                BodyCalculations.calculate(new BodyCalculationInput(
                        new BigDecimal("90"), new BigDecimal("29.999"), null, null,
                        BodyCompositionProtocol.NONE, List.of(), List.of())));

        assertThat(exception.field()).isEqualTo("heightCm");
    }

    private static BodyCalculationInput jacksonPollockInput(FormulaSex sex, int age, String eachFoldMm) {
        return new BodyCalculationInput(
                new BigDecimal("90"),
                new BigDecimal("180"),
                age,
                sex,
                BodyCompositionProtocol.JACKSON_POLLOCK_7_SIRI_1961,
                List.of(),
                jacksonPollockSkinfolds(eachFoldMm));
    }

    private static List<BodySkinfoldValue> jacksonPollockSkinfolds(String eachFoldMm) {
        BigDecimal value = new BigDecimal(eachFoldMm);
        return List.of(
                new BodySkinfoldValue(SkinfoldSite.CHEST, MeasurementSide.RIGHT, value),
                new BodySkinfoldValue(SkinfoldSite.MIDAXILLARY, MeasurementSide.RIGHT, value),
                new BodySkinfoldValue(SkinfoldSite.TRICEPS, MeasurementSide.RIGHT, value),
                new BodySkinfoldValue(SkinfoldSite.SUBSCAPULAR, MeasurementSide.RIGHT, value),
                new BodySkinfoldValue(SkinfoldSite.ABDOMEN, MeasurementSide.RIGHT, value),
                new BodySkinfoldValue(SkinfoldSite.SUPRAILIAC, MeasurementSide.RIGHT, value),
                new BodySkinfoldValue(SkinfoldSite.THIGH, MeasurementSide.RIGHT, value));
    }

    private static Map<BodyResultMetric, BigDecimal> valuesByMetric(BodyCalculationOutcome outcome) {
        return outcome.results().stream().collect(Collectors.toMap(
                BodyCalculatedResult::metric,
                BodyCalculatedResult::value));
    }
}

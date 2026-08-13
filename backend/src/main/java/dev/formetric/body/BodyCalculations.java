package dev.formetric.body;

import dev.formetric.identity.FormulaSex;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class BodyCalculations {

    static final String JACKSON_POLLOCK_7_SIRI_1961 = "JACKSON_POLLOCK_7_SIRI_1961";
    static final int JACKSON_POLLOCK_7_SIRI_REVISION = 1;

    private static final MathContext MATH_CONTEXT = MathContext.DECIMAL128;
    private static final int RESULT_SCALE = 8;
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final BigDecimal SIRI_NUMERATOR = new BigDecimal("495");
    private static final BigDecimal SIRI_OFFSET = new BigDecimal("450");
    private static final BigDecimal MAX_WEIGHT_KG = new BigDecimal("1000");
    private static final BigDecimal MAX_HEIGHT_CM = new BigDecimal("300");
    private static final BigDecimal MIN_HEIGHT_CM = new BigDecimal("30");
    private static final BigDecimal MAX_CIRCUMFERENCE_CM = new BigDecimal("1000");
    private static final BigDecimal MAX_SKINFOLD_MM = new BigDecimal("200");
    private static final BigDecimal MIN_PLAUSIBLE_BODY_FAT_PERCENT = BigDecimal.ZERO;
    private static final BigDecimal MAX_PLAUSIBLE_BODY_FAT_PERCENT = new BigDecimal("75");

    private BodyCalculations() {
    }

    static BodyCalculationOutcome calculate(BodyCalculationInput input) {
        if (input == null) {
            throw new BodyCalculationException("evaluation", "Os dados da avaliação são obrigatórios.");
        }
        validateOptionalPositive(input.weightKg(), MAX_WEIGHT_KG, "weightKg", "peso");
        validateOptionalRange(input.heightCm(), MIN_HEIGHT_CM, MAX_HEIGHT_CM, "heightCm", "altura");
        if (input.ageYears() != null && (input.ageYears() < 0 || input.ageYears() > 130)) {
            throw new BodyCalculationException("ageYears", "A idade deve estar entre 0 e 130 anos.");
        }
        if (input.protocol() == null) {
            throw new BodyCalculationException("protocol", "O protocolo de composição corporal é obrigatório.");
        }

        Map<CircumferenceSite, BigDecimal> circumferences = normalizeCircumferences(input.circumferences());
        Map<SkinfoldSite, BigDecimal> skinfolds = normalizeSkinfolds(input.skinfolds());
        List<BodyCalculatedResult> results = new ArrayList<>();
        Map<BodyWarningCode, BodyCalculationWarning> warnings = new LinkedHashMap<>();

        calculateGeneralMetrics(input, circumferences, skinfolds, results);
        if (input.protocol() == BodyCompositionProtocol.JACKSON_POLLOCK_7_SIRI_1961) {
            calculateJacksonPollock7(input, skinfolds, results, warnings);
        }

        return new BodyCalculationOutcome(List.copyOf(results), List.copyOf(warnings.values()));
    }

    private static void calculateGeneralMetrics(
            BodyCalculationInput input,
            Map<CircumferenceSite, BigDecimal> circumferences,
            Map<SkinfoldSite, BigDecimal> skinfolds,
            List<BodyCalculatedResult> results) {
        if (input.weightKg() != null && input.heightCm() != null) {
            BigDecimal heightM = input.heightCm().divide(ONE_HUNDRED, MATH_CONTEXT);
            add(results, BodyResultMetric.BMI,
                    input.weightKg().divide(heightM.multiply(heightM, MATH_CONTEXT), MATH_CONTEXT),
                    "BMI", 1);
        }
        BigDecimal waist = circumferences.get(CircumferenceSite.WAIST);
        BigDecimal hip = circumferences.get(CircumferenceSite.HIP);
        if (waist != null && hip != null) {
            add(results, BodyResultMetric.WAIST_HIP_RATIO,
                    waist.divide(hip, MATH_CONTEXT), "WAIST_HIP_RATIO", 1);
        }
        if (!circumferences.isEmpty()) {
            add(results, BodyResultMetric.CIRCUMFERENCE_SUM_CM,
                    sum(circumferences.values()), "CIRCUMFERENCE_SUM", 1);
        }
        if (!skinfolds.isEmpty()) {
            add(results, BodyResultMetric.SKINFOLD_SUM_MM,
                    sum(skinfolds.values()), "SKINFOLD_SUM", 1);
        }
    }

    private static void calculateJacksonPollock7(
            BodyCalculationInput input,
            Map<SkinfoldSite, BigDecimal> skinfolds,
            List<BodyCalculatedResult> results,
            Map<BodyWarningCode, BodyCalculationWarning> warnings) {
        if (input.ageYears() == null) {
            throw new BodyCalculationException("ageYears", "A idade é obrigatória para o protocolo Jackson-Pollock 7.");
        }
        if (input.formulaSex() == null) {
            throw new BodyCalculationException(
                    "formulaSex", "O sexo de fórmula é obrigatório para o protocolo Jackson-Pollock 7.");
        }
        if (!skinfolds.keySet().equals(EnumSet.allOf(SkinfoldSite.class))) {
            throw new BodyCalculationException(
                    "skinfolds", "Informe exatamente as sete dobras do protocolo Jackson-Pollock 7.");
        }

        BigDecimal sum = sum(skinfolds.values());
        BigDecimal density = input.formulaSex() == FormulaSex.MALE
                ? maleDensity(sum, input.ageYears())
                : femaleDensity(sum, input.ageYears());
        if (density.signum() == 0) {
            throw new BodyCalculationException(
                    "skinfolds", "A densidade resultante é zero e não permite aplicar a equação de Siri.");
        }
        BigDecimal bodyFatPercent = SIRI_NUMERATOR.divide(density, MATH_CONTEXT).subtract(SIRI_OFFSET, MATH_CONTEXT);
        BigDecimal fatFreePercent = ONE_HUNDRED.subtract(bodyFatPercent, MATH_CONTEXT);

        add(results, BodyResultMetric.BODY_DENSITY_G_PER_ML, density,
                JACKSON_POLLOCK_7_SIRI_1961, JACKSON_POLLOCK_7_SIRI_REVISION);
        add(results, BodyResultMetric.BODY_FAT_PERCENT, bodyFatPercent,
                JACKSON_POLLOCK_7_SIRI_1961, JACKSON_POLLOCK_7_SIRI_REVISION);
        add(results, BodyResultMetric.FAT_FREE_MASS_PERCENT, fatFreePercent,
                JACKSON_POLLOCK_7_SIRI_1961, JACKSON_POLLOCK_7_SIRI_REVISION);
        if (input.weightKg() != null) {
            BigDecimal fatMass = input.weightKg()
                    .multiply(bodyFatPercent, MATH_CONTEXT)
                    .divide(ONE_HUNDRED, MATH_CONTEXT);
            add(results, BodyResultMetric.FAT_MASS_KG, fatMass,
                    JACKSON_POLLOCK_7_SIRI_1961, JACKSON_POLLOCK_7_SIRI_REVISION);
            add(results, BodyResultMetric.FAT_FREE_MASS_KG,
                    input.weightKg().subtract(fatMass, MATH_CONTEXT),
                    JACKSON_POLLOCK_7_SIRI_1961, JACKSON_POLLOCK_7_SIRI_REVISION);
        }

        addProtocolWarnings(input.formulaSex(), input.ageYears(), sum, bodyFatPercent, warnings);
    }

    private static BigDecimal maleDensity(BigDecimal sum, int age) {
        return new BigDecimal("1.11200000")
                .subtract(new BigDecimal("0.00043499").multiply(sum, MATH_CONTEXT), MATH_CONTEXT)
                .add(new BigDecimal("0.00000055").multiply(sum.multiply(sum, MATH_CONTEXT), MATH_CONTEXT), MATH_CONTEXT)
                .subtract(new BigDecimal("0.00028826").multiply(BigDecimal.valueOf(age), MATH_CONTEXT), MATH_CONTEXT);
    }

    private static BigDecimal femaleDensity(BigDecimal sum, int age) {
        return new BigDecimal("1.09700000")
                .subtract(new BigDecimal("0.00046971").multiply(sum, MATH_CONTEXT), MATH_CONTEXT)
                .add(new BigDecimal("0.00000056").multiply(sum.multiply(sum, MATH_CONTEXT), MATH_CONTEXT), MATH_CONTEXT)
                .subtract(new BigDecimal("0.00012828").multiply(BigDecimal.valueOf(age), MATH_CONTEXT), MATH_CONTEXT);
    }

    private static void addProtocolWarnings(
            FormulaSex formulaSex,
            int age,
            BigDecimal skinfoldSum,
            BigDecimal bodyFatPercent,
            Map<BodyWarningCode, BodyCalculationWarning> warnings) {
        boolean extrapolated = false;
        if ((formulaSex == FormulaSex.MALE && (age < 18 || age > 61))
                || (formulaSex == FormulaSex.FEMALE && (age < 18 || age > 55))) {
            warn(warnings, BodyWarningCode.OUTSIDE_VALIDATED_AGE_RANGE,
                    "A idade está fora da faixa da população usada para validar a equação.");
            extrapolated = true;
        }
        if (formulaSex == FormulaSex.FEMALE && age > 40) {
            warn(warnings, BodyWarningCode.FEMALE_OVER_40_LIMITED_VALIDATION,
                    "O estudo original recomenda cautela adicional para mulheres acima de 40 anos.");
        }
        if (formulaSex == FormulaSex.MALE
                && (skinfoldSum.compareTo(new BigDecimal("32")) < 0
                || skinfoldSum.compareTo(new BigDecimal("272")) > 0)) {
            warn(warnings, BodyWarningCode.MALE_SUM_OUTSIDE_REFERENCE_RANGE,
                    "A soma das sete dobras está fora da faixa de referência publicada para homens.");
            extrapolated = true;
        }
        if (extrapolated) {
            warn(warnings, BodyWarningCode.EXTRAPOLATED,
                    "O resultado é uma extrapolação matemática e possui incerteza adicional.");
        }
        if (bodyFatPercent.compareTo(MIN_PLAUSIBLE_BODY_FAT_PERCENT) < 0
                || bodyFatPercent.compareTo(MAX_PLAUSIBLE_BODY_FAT_PERCENT) > 0) {
            warn(warnings, BodyWarningCode.OUTSIDE_PLAUSIBLE_RESULT,
                    "O percentual calculado está fora da faixa plausível usada pela aplicação; o valor não foi ajustado.");
        }
    }

    private static Map<CircumferenceSite, BigDecimal> normalizeCircumferences(
            List<BodyCircumferenceValue> values) {
        Map<CircumferenceSite, BigDecimal> normalized = new EnumMap<>(CircumferenceSite.class);
        for (BodyCircumferenceValue value : values == null ? List.<BodyCircumferenceValue>of() : values) {
            if (value == null || value.site() == null) {
                throw new BodyCalculationException("circumferences", "Cada perímetro deve informar um local.");
            }
            validateRequiredPositive(
                    value.valueCm(), MAX_CIRCUMFERENCE_CM, "circumferences", "medida de perímetro");
            if (normalized.putIfAbsent(value.site(), value.valueCm()) != null) {
                throw new BodyCalculationException("circumferences", "Um mesmo perímetro não pode se repetir.");
            }
        }
        return normalized;
    }

    private static Map<SkinfoldSite, BigDecimal> normalizeSkinfolds(List<BodySkinfoldValue> values) {
        Map<SkinfoldSite, BigDecimal> normalized = new EnumMap<>(SkinfoldSite.class);
        for (BodySkinfoldValue value : values == null ? List.<BodySkinfoldValue>of() : values) {
            if (value == null || value.site() == null || value.side() == null) {
                throw new BodyCalculationException("skinfolds", "Cada dobra deve informar local e lado.");
            }
            validateRequiredPositive(value.valueMm(), MAX_SKINFOLD_MM, "skinfolds", "medida da dobra");
            if (normalized.putIfAbsent(value.site(), value.valueMm()) != null) {
                throw new BodyCalculationException("skinfolds", "Uma mesma dobra não pode se repetir.");
            }
        }
        return normalized;
    }

    private static void validateOptionalPositive(
            BigDecimal value, BigDecimal maximum, String field, String label) {
        if (value != null) {
            validateRequiredPositive(value, maximum, field, label);
        }
    }

    private static void validateOptionalRange(
            BigDecimal value,
            BigDecimal minimum,
            BigDecimal maximum,
            String field,
            String label) {
        if (value != null && (value.compareTo(minimum) < 0 || value.compareTo(maximum) > 0)) {
            throw new BodyCalculationException(
                    field,
                    "A " + label + " deve estar entre " + minimum.toPlainString()
                            + " e " + maximum.toPlainString() + ".");
        }
    }

    private static void validateRequiredPositive(
            BigDecimal value, BigDecimal maximum, String field, String label) {
        if (value == null || value.signum() <= 0 || value.compareTo(maximum) > 0) {
            throw new BodyCalculationException(
                    field, "A " + label + " deve ser maior que zero e de até " + maximum.toPlainString() + ".");
        }
    }

    private static BigDecimal sum(Iterable<BigDecimal> values) {
        BigDecimal result = BigDecimal.ZERO;
        for (BigDecimal value : values) {
            result = result.add(value, MATH_CONTEXT);
        }
        return result;
    }

    private static void add(
            List<BodyCalculatedResult> results,
            BodyResultMetric metric,
            BigDecimal rawValue,
            String methodCode,
            int methodRevision) {
        results.add(new BodyCalculatedResult(
                metric,
                rawValue.setScale(RESULT_SCALE, RoundingMode.HALF_UP),
                methodCode,
                methodRevision));
    }

    private static void warn(
            Map<BodyWarningCode, BodyCalculationWarning> warnings,
            BodyWarningCode code,
            String message) {
        warnings.putIfAbsent(code, new BodyCalculationWarning(code, message));
    }
}

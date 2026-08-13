package dev.formetric.body;

import dev.formetric.identity.FormulaSex;
import java.math.BigDecimal;
import java.util.List;

enum BodyEvaluationSource {
    SELF,
    PROFESSIONAL,
    IMPORT_CONFIRMED
}

enum BodyCompositionProtocol {
    NONE,
    JACKSON_POLLOCK_7_SIRI_1961
}

enum ReportedMethodType {
    UNSPECIFIED,
    SKINFOLD,
    BIOIMPEDANCE,
    DXA,
    OTHER
}

enum CircumferenceSite {
    NECK,
    SHOULDERS,
    CHEST,
    ABDOMEN,
    WAIST,
    HIP,
    LEFT_ARM,
    RIGHT_ARM,
    LEFT_THIGH,
    RIGHT_THIGH,
    LEFT_CALF,
    RIGHT_CALF
}

enum SkinfoldSite {
    CHEST,
    MIDAXILLARY,
    TRICEPS,
    SUBSCAPULAR,
    ABDOMEN,
    SUPRAILIAC,
    THIGH
}

enum MeasurementSide {
    RIGHT,
    LEFT,
    UNSPECIFIED
}

enum BodyResultMetric {
    BMI,
    WAIST_HIP_RATIO,
    CIRCUMFERENCE_SUM_CM,
    SKINFOLD_SUM_MM,
    BODY_DENSITY_G_PER_ML,
    BODY_FAT_PERCENT,
    FAT_MASS_KG,
    FAT_FREE_MASS_PERCENT,
    FAT_FREE_MASS_KG,
    LEAN_BODY_MASS_KG,
    LEAN_SOFT_TISSUE_MASS_KG,
    SKELETAL_MUSCLE_MASS_KG,
    UNSPECIFIED_LEAN_MASS_KG
}

enum BodyResultProvenance {
    REPORTED,
    SYSTEM_CALCULATED,
    SYSTEM_DERIVED_FROM_REPORTED
}

enum BodyWarningCode {
    OUTSIDE_VALIDATED_AGE_RANGE,
    FEMALE_OVER_40_LIMITED_VALIDATION,
    MALE_SUM_OUTSIDE_REFERENCE_RANGE,
    EXTRAPOLATED,
    OUTSIDE_PLAUSIBLE_RESULT
}

enum BodyComparisonCompatibility {
    SAME_METHOD,
    METHOD_CHANGED,
    MISSING
}

enum BodyEvaluationArchiveStatus {
    ACTIVE,
    ARCHIVED,
    ALL
}

record BodyCircumferenceValue(CircumferenceSite site, BigDecimal valueCm) {
}

record BodySkinfoldValue(SkinfoldSite site, MeasurementSide side, BigDecimal valueMm) {
}

record BodyCalculationInput(
        BigDecimal weightKg,
        BigDecimal heightCm,
        Integer ageYears,
        FormulaSex formulaSex,
        BodyCompositionProtocol protocol,
        List<BodyCircumferenceValue> circumferences,
        List<BodySkinfoldValue> skinfolds) {
}

record BodyCalculatedResult(
        BodyResultMetric metric,
        BigDecimal value,
        String methodCode,
        int methodRevision) {
}

record BodyCalculationWarning(BodyWarningCode code, String message) {
}

record BodyCalculationOutcome(
        List<BodyCalculatedResult> results,
        List<BodyCalculationWarning> warnings) {
}

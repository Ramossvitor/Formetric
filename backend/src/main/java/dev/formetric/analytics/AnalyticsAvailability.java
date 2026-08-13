package dev.formetric.analytics;

/** Explains why a series point has, or does not have, a deterministic value. */
public enum AnalyticsAvailability {
    AVAILABLE,
    MISSING_LOG,
    OPEN_LOG,
    MISSING_VALUE,
    MISSING_TDEE
}

package dev.formetric.analytics;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;

final class AnalyticsRules {

    static final int MAX_SERIES_DAYS = 366;

    private AnalyticsRules() {
    }

    static void validateDate(LocalDate date) {
        if (date == null) {
            throw new AnalyticsValidationException("date", "A data é obrigatória.");
        }
    }

    static void validateMonth(YearMonth month) {
        if (month == null) {
            throw new AnalyticsValidationException("month", "O mês é obrigatório.");
        }
    }

    static void validateSeries(AnalyticsMetric metric, LocalDate from, LocalDate to) {
        if (metric == null) {
            throw new AnalyticsValidationException("metric", "A métrica é obrigatória.");
        }
        if (from == null) {
            throw new AnalyticsValidationException("from", "A data inicial é obrigatória.");
        }
        if (to == null) {
            throw new AnalyticsValidationException("to", "A data final é obrigatória.");
        }
        if (from.isAfter(to)) {
            throw new AnalyticsValidationException(
                    "to", "A data final não pode ser anterior à data inicial.");
        }
        if (ChronoUnit.DAYS.between(from, to) >= MAX_SERIES_DAYS) {
            throw new AnalyticsValidationException(
                    "to", "A série deve possuir no máximo 366 dias, incluindo as duas datas.");
        }
    }
}

package dev.formetric.activity;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class ActivityRangeRulesTest {

    @Test
    void acceptsTheInclusiveFiveYearBoundary() {
        assertDoesNotThrow(() -> ActivityRangeRules.validate(
                LocalDate.parse("2020-02-29"),
                LocalDate.parse("2025-02-27")));
    }

    @Test
    void rejectsTheFirstDayBeyondTheFiveYearBoundary() {
        ActivityValidationException exception = assertThrows(
                ActivityValidationException.class,
                () -> ActivityRangeRules.validate(
                        LocalDate.parse("2020-02-29"),
                        LocalDate.parse("2025-02-28")));

        assertEquals("to", exception.field());
    }
}

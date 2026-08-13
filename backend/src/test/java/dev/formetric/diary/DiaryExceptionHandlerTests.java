package dev.formetric.diary;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ProblemDetail;

class DiaryExceptionHandlerTests {

    @Test
    void validationProblemUsesSharedFieldErrorsContract() {
        ProblemDetail problem = new DiaryExceptionHandler().invalidRule(
                new DiaryValidationException("fastingConfirmed", "Confirme o jejum."));

        assertThat(problem.getStatus()).isEqualTo(400);
        assertThat(problem.getProperties()).containsEntry(
                "fieldErrors", List.of(Map.of("field", "fastingConfirmed", "message", "Confirme o jejum.")));
    }
}

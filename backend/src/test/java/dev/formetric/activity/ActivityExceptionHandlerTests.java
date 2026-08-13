package dev.formetric.activity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ProblemDetail;

class ActivityExceptionHandlerTests {

    private final ActivityExceptionHandler handler = new ActivityExceptionHandler();

    @Test
    void ruleValidationUsesSharedProblemDetailsAndFieldErrorsContract() {
        ProblemDetail problem = handler.invalidRule(
                new ActivityValidationException("durationMinutes", "A duração é inválida."));

        assertThat(problem.getStatus()).isEqualTo(400);
        assertThat(problem.getProperties()).containsEntry("code", "ACTIVITY_VALIDATION");
        assertThat(problem.getProperties()).containsEntry(
                "fieldErrors",
                List.of(Map.of("field", "durationMinutes", "message", "A duração é inválida.")));
    }

    @Test
    void crossUserSafeNotFoundUsesStableCode() {
        ProblemDetail problem = handler.notFound(new ActivityNotFoundException("Treino não encontrado."));

        assertThat(problem.getStatus()).isEqualTo(404);
        assertThat(problem.getProperties()).containsEntry("code", "ACTIVITY_NOT_FOUND");
    }
}

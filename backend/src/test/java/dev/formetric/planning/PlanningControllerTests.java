package dev.formetric.planning;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ProblemDetail;

class PlanningControllerTests {

    private final PlanningExceptionHandler handler = new PlanningExceptionHandler();

    @Test
    void ruleValidationUsesSharedFieldErrorsContract() {
        ProblemDetail problem = handler.invalidPlanningRule(
                new PlanningValidationException("validTo", "A data final é inválida."));

        assertThat(problem.getStatus()).isEqualTo(400);
        assertThat(problem.getProperties()).containsKey("fieldErrors");
        assertThat(problem.getProperties()).doesNotContainKey("errors");
        assertThat(problem.getProperties().get("fieldErrors"))
                .isEqualTo(java.util.List.of(Map.of(
                        "field", "validTo",
                        "message", "A data final é inválida.")));
    }
}

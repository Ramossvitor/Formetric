package dev.formetric.planning;

import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = {NutritionGoalPeriodController.class, TdeePeriodController.class})
class PlanningExceptionHandler {

    @ExceptionHandler(PlanningConflictException.class)
    ProblemDetail conflict(PlanningConflictException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        problem.setTitle("Conflito de vigência");
        problem.setType(URI.create("https://formetric.dev/problems/planning-period-conflict"));
        problem.setProperty("code", "PLANNING_PERIOD_CONFLICT");
        return problem;
    }

    @ExceptionHandler(PlanningPeriodNotFoundException.class)
    ProblemDetail notFound(PlanningPeriodNotFoundException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
        problem.setTitle("Vigência não encontrada");
        problem.setType(URI.create("https://formetric.dev/problems/planning-period-not-found"));
        problem.setProperty("code", "PLANNING_PERIOD_NOT_FOUND");
        return problem;
    }

    @ExceptionHandler(PlanningValidationException.class)
    ProblemDetail invalidPlanningRule(PlanningValidationException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setTitle("Dados de planejamento inválidos");
        problem.setType(URI.create("https://formetric.dev/problems/planning-validation"));
        problem.setProperty("code", "PLANNING_VALIDATION");
        problem.setProperty("fieldErrors", List.of(Map.of("field", exception.field(), "message", exception.getMessage())));
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalidRequest(MethodArgumentNotValidException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Revise os campos informados e tente novamente.");
        problem.setTitle("Requisição inválida");
        problem.setType(URI.create("https://formetric.dev/problems/request-validation"));
        problem.setProperty("code", "REQUEST_VALIDATION");
        problem.setProperty("fieldErrors", exception.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of(
                        "field", error.getField(),
                        "message", error.getDefaultMessage() == null ? "Valor inválido." : error.getDefaultMessage()))
                .toList());
        return problem;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ProblemDetail invalidParameter(ConstraintViolationException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setTitle("Parâmetro inválido");
        problem.setType(URI.create("https://formetric.dev/problems/request-validation"));
        problem.setProperty("code", "REQUEST_VALIDATION");
        return problem;
    }
}

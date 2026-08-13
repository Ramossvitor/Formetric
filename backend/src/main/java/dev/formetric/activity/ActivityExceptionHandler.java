package dev.formetric.activity;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = {WorkoutController.class, WeightLogController.class})
class ActivityExceptionHandler {

    @ExceptionHandler(ActivityNotFoundException.class)
    ProblemDetail notFound(ActivityNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "Registro não encontrado", exception.getMessage(), "ACTIVITY_NOT_FOUND");
    }

    @ExceptionHandler({
            ActivityConflictException.class,
            DataIntegrityViolationException.class,
            ObjectOptimisticLockingFailureException.class
    })
    ProblemDetail conflict(Exception exception) {
        String detail = exception instanceof ActivityConflictException
                ? exception.getMessage()
                : "A operação conflita com outra alteração ou registro existente.";
        return problem(HttpStatus.CONFLICT, "Conflito no histórico", detail, "ACTIVITY_CONFLICT");
    }

    @ExceptionHandler(ActivityValidationException.class)
    ProblemDetail invalidRule(ActivityValidationException exception) {
        ProblemDetail problem = problem(
                HttpStatus.BAD_REQUEST,
                "Dados de atividade inválidos",
                exception.getMessage(),
                "ACTIVITY_VALIDATION");
        problem.setProperty(
                "fieldErrors",
                List.of(Map.of("field", exception.field(), "message", exception.getMessage())));
        return problem;
    }

    private static ProblemDetail problem(HttpStatus status, String title, String detail, String code) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setType(URI.create("https://formetric.dev/problems/" + code.toLowerCase().replace('_', '-')));
        problem.setProperty("code", code);
        return problem;
    }
}

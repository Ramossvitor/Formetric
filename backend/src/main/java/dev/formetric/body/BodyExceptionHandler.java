package dev.formetric.body;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = BodyEvaluationController.class)
class BodyExceptionHandler {

    @ExceptionHandler(BodyNotFoundException.class)
    ProblemDetail notFound(BodyNotFoundException exception) {
        return problem(
                HttpStatus.NOT_FOUND,
                "Avaliação não encontrada",
                exception.getMessage(),
                "BODY_EVALUATION_NOT_FOUND");
    }

    @ExceptionHandler({
            BodyConflictException.class,
            DataIntegrityViolationException.class,
            ObjectOptimisticLockingFailureException.class
    })
    ProblemDetail conflict(Exception exception) {
        String detail = exception instanceof BodyConflictException
                ? exception.getMessage()
                : "A operação conflita com outra alteração ou registro existente.";
        return problem(HttpStatus.CONFLICT, "Conflito na avaliação", detail, "BODY_EVALUATION_CONFLICT");
    }

    @ExceptionHandler({BodyValidationException.class, BodyCalculationException.class})
    ProblemDetail invalidRule(RuntimeException exception) {
        String field = exception instanceof BodyValidationException validation
                ? validation.field()
                : ((BodyCalculationException) exception).field();
        ProblemDetail problem = problem(
                HttpStatus.BAD_REQUEST,
                "Dados corporais inválidos",
                exception.getMessage(),
                "BODY_EVALUATION_VALIDATION");
        problem.setProperty("fieldErrors", List.of(Map.of("field", field, "message", exception.getMessage())));
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

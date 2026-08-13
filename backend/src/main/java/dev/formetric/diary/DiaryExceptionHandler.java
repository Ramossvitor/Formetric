package dev.formetric.diary;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = DiaryController.class)
class DiaryExceptionHandler {

    @ExceptionHandler(DiaryNotFoundException.class)
    ProblemDetail notFound(DiaryNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "Registro não encontrado", exception.getMessage(), "DIARY_NOT_FOUND");
    }

    @ExceptionHandler({DiaryConflictException.class, DataIntegrityViolationException.class,
            ObjectOptimisticLockingFailureException.class})
    ProblemDetail conflict(Exception exception) {
        String detail = exception instanceof DiaryConflictException
                ? exception.getMessage()
                : "A operação conflita com outra alteração ou registro existente.";
        return problem(HttpStatus.CONFLICT, "Conflito no diário", detail, "DIARY_CONFLICT");
    }

    @ExceptionHandler(DiaryValidationException.class)
    ProblemDetail invalidRule(DiaryValidationException exception) {
        ProblemDetail problem = problem(
                HttpStatus.BAD_REQUEST, "Dados do diário inválidos", exception.getMessage(), "DIARY_VALIDATION");
        problem.setProperty("fieldErrors", List.of(Map.of("field", exception.field(), "message", exception.getMessage())));
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalidRequest(MethodArgumentNotValidException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Requisição inválida",
                "Revise os campos informados e tente novamente.", "REQUEST_VALIDATION");
        problem.setProperty("fieldErrors", exception.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of("field", error.getField(), "message",
                        error.getDefaultMessage() == null ? "Valor inválido." : error.getDefaultMessage()))
                .toList());
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

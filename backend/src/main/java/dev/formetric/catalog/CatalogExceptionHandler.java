package dev.formetric.catalog;

import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = {FoodController.class, RecipeController.class})
class CatalogExceptionHandler {

    @ExceptionHandler(CatalogNotFoundException.class)
    ProblemDetail notFound(CatalogNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "Item não encontrado", exception.getMessage(),
                "catalog-not-found", "CATALOG_NOT_FOUND");
    }

    @ExceptionHandler(CatalogNutritionResolutionException.class)
    ProblemDetail resolution(CatalogNutritionResolutionException exception) {
        HttpStatus status = exception.reason() == CatalogNutritionResolutionException.Reason.NOT_FOUND
                ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        ProblemDetail problem = problem(status, "Não foi possível calcular o item", exception.getMessage(),
                "catalog-resolution", "CATALOG_RESOLUTION_" + exception.reason().name());
        problem.setProperty("reason", exception.reason().name());
        return problem;
    }

    @ExceptionHandler(CatalogValidationException.class)
    ProblemDetail validation(CatalogValidationException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Dados do catálogo inválidos",
                exception.getMessage(), "catalog-validation", "CATALOG_VALIDATION");
        problem.setProperty("fieldErrors", List.of(Map.of(
                "field", exception.field(), "message", exception.getMessage())));
        return problem;
    }

    @ExceptionHandler({CatalogConflictException.class, DataIntegrityViolationException.class})
    ProblemDetail conflict(Exception exception) {
        return problem(HttpStatus.CONFLICT, "Conflito no catálogo",
                "O item conflita com um registro existente.", "catalog-conflict", "CATALOG_CONFLICT");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalidRequest(MethodArgumentNotValidException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Requisição inválida",
                "Revise os campos informados e tente novamente.", "request-validation", "REQUEST_VALIDATION");
        problem.setProperty("fieldErrors", exception.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of(
                        "field", error.getField(),
                        "message", error.getDefaultMessage() == null ? "Valor inválido." : error.getDefaultMessage()))
                .toList());
        return problem;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ProblemDetail invalidParameter(ConstraintViolationException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Parâmetro inválido", exception.getMessage(),
                "request-validation", "REQUEST_VALIDATION");
        problem.setProperty("fieldErrors", exception.getConstraintViolations().stream()
                .map(violation -> Map.of(
                        "field", violation.getPropertyPath().toString(),
                        "message", violation.getMessage()))
                .toList());
        return problem;
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail unreadable(HttpMessageNotReadableException exception) {
        return problem(HttpStatus.BAD_REQUEST, "Requisição inválida",
                "O corpo contém um valor ausente ou não reconhecido.",
                "request-validation", "REQUEST_VALIDATION");
    }

    private ProblemDetail problem(
            HttpStatus status, String title, String detail, String type, String code) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setType(URI.create("https://formetric.dev/problems/" + type));
        problem.setProperty("code", code);
        return problem;
    }
}

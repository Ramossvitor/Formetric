package dev.formetric.identity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class IdentityExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> invalidBody(MethodArgumentNotValidException exception, HttpServletRequest request) {
        List<FieldErrorDetail> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldErrorDetail(error.getField(), error.getDefaultMessage()))
                .toList();
        ProblemDetail problem = problem(
                HttpStatus.BAD_REQUEST,
                "Dados inválidos",
                "Revise os campos informados.",
                request);
        problem.setProperty("fieldErrors", errors);
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(InvalidProfileException.class)
    ResponseEntity<ProblemDetail> invalidProfile(InvalidProfileException exception, HttpServletRequest request) {
        ProblemDetail problem = problem(
                HttpStatus.BAD_REQUEST,
                "Dados inválidos",
                "Revise os campos informados.",
                request);
        problem.setProperty("fieldErrors", List.of(new FieldErrorDetail(exception.field(), exception.getMessage())));
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler({ConstraintViolationException.class, HttpMessageNotReadableException.class})
    ResponseEntity<ProblemDetail> malformedRequest(Exception exception, HttpServletRequest request) {
        return ResponseEntity.badRequest().body(problem(
                HttpStatus.BAD_REQUEST,
                "Requisição inválida",
                "Não foi possível processar os dados enviados.",
                request));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    ResponseEntity<ProblemDetail> invalidCredentials(InvalidCredentialsException exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem(
                HttpStatus.UNAUTHORIZED, "Credenciais inválidas", exception.getMessage(), request));
    }

    @ExceptionHandler(UnauthenticatedException.class)
    ResponseEntity<ProblemDetail> unauthenticated(UnauthenticatedException exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem(
                HttpStatus.UNAUTHORIZED, "Não autenticado", exception.getMessage(), request));
    }

    @ExceptionHandler(LoginRateLimitedException.class)
    ResponseEntity<ProblemDetail> loginRateLimited(LoginRateLimitedException exception, HttpServletRequest request) {
        ProblemDetail problem = problem(
                HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas", exception.getMessage(), request);
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(exception.retryAfterSeconds()))
                .body(problem);
    }

    @ExceptionHandler(InvalidInviteException.class)
    ResponseEntity<ProblemDetail> invalidInvite(InvalidInviteException exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(problem(
                HttpStatus.UNPROCESSABLE_CONTENT, "Convite inválido", exception.getMessage(), request));
    }

    @ExceptionHandler(IdentityConflictException.class)
    ResponseEntity<ProblemDetail> conflict(IdentityConflictException exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem(
                HttpStatus.CONFLICT, "Conflito", exception.getMessage(), request));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ProblemDetail> notFound(ResourceNotFoundException exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem(
                HttpStatus.NOT_FOUND, "Não encontrado", exception.getMessage(), request));
    }

    private static ProblemDetail problem(
            HttpStatus status,
            String title,
            String detail,
            HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setInstance(URI.create(request.getRequestURI()));
        return problem;
    }

    record FieldErrorDetail(String field, String message) {
    }
}

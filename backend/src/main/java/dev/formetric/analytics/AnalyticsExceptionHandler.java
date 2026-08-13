package dev.formetric.analytics;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = AnalyticsController.class)
class AnalyticsExceptionHandler {

    @ExceptionHandler(AnalyticsValidationException.class)
    ProblemDetail invalidRule(AnalyticsValidationException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setTitle("Consulta analítica inválida");
        problem.setType(URI.create("https://formetric.dev/problems/analytics-validation"));
        problem.setProperty("code", "ANALYTICS_VALIDATION");
        problem.setProperty(
                "fieldErrors",
                List.of(Map.of("field", exception.field(), "message", exception.getMessage())));
        return problem;
    }
}

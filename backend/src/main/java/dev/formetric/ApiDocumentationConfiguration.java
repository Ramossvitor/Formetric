package dev.formetric;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class ApiDocumentationConfiguration {

    @Bean
    OpenAPI formetricOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Formetric API")
                        .version("v1")
                        .description("API for nutrition, activity and body evolution tracking."));
    }
}

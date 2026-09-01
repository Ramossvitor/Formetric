package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

class ProductionConfigurationTests {

    @Test
    void productionProfileRequiresExternalConnectionsAndAppliesFailSafeDefaults() throws IOException {
        YamlPropertySourceLoader loader = new YamlPropertySourceLoader();
        PropertySource<?> properties = loader
                .load("production", new ClassPathResource("application-prod.yml"))
                .getFirst();
        PropertySource<?> baseProperties = loader
                .load("base", new ClassPathResource("application.yml"))
                .getFirst();

        assertThat(properties.getProperty("spring.datasource.url")).isEqualTo("${DB_POOLER_URL}");
        assertThat(properties.getProperty("spring.datasource.username")).isEqualTo("${DB_USERNAME}");
        assertThat(properties.getProperty("spring.datasource.password")).isEqualTo("${DB_PASSWORD}");
        assertThat(properties.getProperty("spring.datasource.hikari.maximum-pool-size")).isEqualTo(5);
        assertThat(properties.getProperty("spring.datasource.hikari.minimum-idle")).isEqualTo(0);
        // Milissegundos crus: o bloco hikari vai direto para o HikariConfig, que não aceita
        // sufixos de duração — "10s" derruba o contexto na inicialização (visto no Cloud Run).
        assertThat(properties.getProperty("spring.datasource.hikari.connection-timeout")).isEqualTo(10000);
        assertThat(properties.getProperty("spring.datasource.hikari.validation-timeout")).isEqualTo(5000);
        assertThat(properties.getProperty("spring.datasource.hikari.idle-timeout")).isEqualTo(120000);
        assertThat(properties.getProperty("spring.datasource.hikari.max-lifetime")).isEqualTo(1500000);
        assertThat(properties.getProperty("spring.flyway.url")).isEqualTo("${DB_DIRECT_URL}");
        assertThat(properties.getProperty("server.port")).isEqualTo("${PORT}");
        assertThat(properties.getProperty("server.shutdown")).isEqualTo("graceful");
        assertThat(properties.getProperty("spring.lifecycle.timeout-per-shutdown-phase")).isEqualTo("8s");
        assertThat(properties.getProperty("server.servlet.session.cookie.secure")).isEqualTo(true);
        // 30 dias, e não mais 12 horas. É um afrouxamento consciente, feito para o aplicativo
        // instalado: uma tela de login a cada abertura é a diferença entre um app e um site, e um
        // diário alimentar que pede senha diariamente é um diário alimentar abandonado. O que
        // sustenta o prazo é o cookie HttpOnly + Secure + SameSite=Lax, o hash Argon2 e a
        // revalidação de sessão a cada requisição autenticada.
        assertThat(properties.getProperty("spring.session.timeout")).isEqualTo("30d");
        assertThat(properties.getProperty("server.servlet.session.timeout")).isEqualTo("30d");
        assertThat(properties.getProperty("springdoc.api-docs.enabled")).isEqualTo(false);
        assertThat(properties.getProperty("springdoc.swagger-ui.enabled")).isEqualTo(false);
        assertThat(properties.getProperty("management.endpoints.web.exposure.include")).isEqualTo("health");
        assertThat(properties.getProperty("formetric.bootstrap.admin-email"))
                .isEqualTo("${BOOTSTRAP_ADMIN_EMAIL:}");
        assertThat(properties.getProperty("formetric.bootstrap.admin-password"))
                .isEqualTo("${BOOTSTRAP_ADMIN_PASSWORD:}");
        assertThat(properties.getProperty("formetric.bootstrap.admin-display-name"))
                .isEqualTo("${BOOTSTRAP_ADMIN_DISPLAY_NAME:}");
        assertThat(baseProperties.getProperty("server.max-http-request-header-size")).isEqualTo("16KB");
        assertThat(baseProperties.getProperty("server.tomcat.max-http-form-post-size")).isEqualTo("2MB");
        assertThat(baseProperties.getProperty("spring.servlet.multipart.max-request-size")).isEqualTo("2MB");
    }
}

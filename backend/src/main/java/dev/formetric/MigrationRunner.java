package dev.formetric;

import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * One-shot entry point for schema releases. Flyway already ran during context refresh, so the
 * runner only has to terminate: a non-zero exit code then means the migration failed and the
 * release must stop before any revision serves the new schema.
 */
@Configuration(proxyBeanMethods = false)
@Profile("migrate")
class MigrationRunner {

    @Bean
    ApplicationRunner migrationExit(ApplicationContext context) {
        return args -> System.exit(SpringApplication.exit(context, () -> 0));
    }
}

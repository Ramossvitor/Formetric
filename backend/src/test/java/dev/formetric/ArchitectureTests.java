package dev.formetric;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ArchitectureTests {

    @Test
    void moduleDependenciesAreValid() {
        ApplicationModules.of(FormetricApplication.class).verify();
    }
}

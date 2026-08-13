package dev.formetric;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ArchitectureTests {

    @Test
    void moduleDependenciesAreValid() {
        ApplicationModules.of(FormetricApplication.class).verify();
    }

    @Test
    void activityAndEnergyModulesRemainDecoupled() {
        var productionClasses = new ClassFileImporter().importPackages("dev.formetric");

        noClasses()
                .that().resideInAPackage("dev.formetric.activity..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "dev.formetric.diary..", "dev.formetric.planning..")
                .because("workout calories are informational and must not alter TDEE or diary energy balance")
                .check(productionClasses);

        noClasses()
                .that().resideInAnyPackage("dev.formetric.diary..", "dev.formetric.planning..")
                .should().dependOnClassesThat().resideInAPackage("dev.formetric.activity..")
                .because("diary energy balance must remain based exclusively on consumed calories and effective TDEE")
                .check(productionClasses);
    }
}

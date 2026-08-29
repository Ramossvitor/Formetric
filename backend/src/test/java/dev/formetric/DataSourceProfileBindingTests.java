package dev.formetric;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zaxxer.hikari.HikariConfig;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.ConfigurationPropertySource;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;
import org.springframework.core.io.ClassPathResource;

/**
 * O bloco {@code spring.datasource.hikari} é vinculado direto ao {@link HikariConfig}, que só
 * aceita {@code long} em milissegundos. Sufixos de duração ("10s", "2m") passam por todos os
 * perfis de teste e derrubam o contexto apenas no Cloud Run — este teste liga os perfis de
 * produção à mesma regra de binding sem precisar de banco.
 */
class DataSourceProfileBindingTests {

    @ParameterizedTest
    @ValueSource(strings = {"application-prod.yml", "application-migrate.yml"})
    void hikariBlockBindsToHikariConfig(String resource) {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource(resource));
        Properties properties = yaml.getObject();

        ConfigurationPropertySource source = new MapConfigurationPropertySource(properties);
        Binder binder = new Binder(source);

        assertThatCode(() -> binder.bind("spring.datasource.hikari", Bindable.of(HikariConfig.class)))
                .as("%s must bind cleanly into HikariConfig", resource)
                .doesNotThrowAnyException();
    }

    @Test
    void bindingRejectsDurationSuffixes() {
        Properties properties = new Properties();
        properties.setProperty("spring.datasource.hikari.connection-timeout", "10s");
        Binder binder = new Binder(new MapConfigurationPropertySource(properties));

        assertThatThrownBy(() -> binder.bind("spring.datasource.hikari", Bindable.of(HikariConfig.class)))
                .as("the guard itself must fail on duration suffixes, or the parameterized test proves nothing")
                .isInstanceOf(Exception.class);
    }
}

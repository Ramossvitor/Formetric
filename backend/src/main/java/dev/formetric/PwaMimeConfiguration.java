package dev.formetric;

import org.springframework.boot.web.server.MimeMappings;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.server.servlet.ConfigurableServletWebServerFactory;
import org.springframework.context.annotation.Configuration;

/**
 * Registra o tipo do manifesto de aplicativo web.
 *
 * <p>O Tomcat não conhece a extensão {@code .webmanifest} e servia o arquivo como
 * {@code application/octet-stream}. A especificação exige {@code application/manifest+json}, e
 * validadores de instalabilidade recusam o manifesto sem ele — o que apareceria como "o app não é
 * instalável" sem nenhuma indicação do motivo.
 */
@Configuration(proxyBeanMethods = false)
class PwaMimeConfiguration implements WebServerFactoryCustomizer<ConfigurableServletWebServerFactory> {

    @Override
    public void customize(ConfigurableServletWebServerFactory factory) {
        MimeMappings mappings = new MimeMappings(MimeMappings.DEFAULT);
        mappings.add("webmanifest", "application/manifest+json");
        factory.setMimeMappings(mappings);
    }
}

package dev.formetric.identity;

import jakarta.servlet.http.HttpServletResponse;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ContentSecurityPolicyHeaderWriter;
import org.springframework.security.web.header.writers.PermissionsPolicyHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration(proxyBeanMethods = false)
class SecurityConfiguration {

    @Bean
    SecurityFilterChain applicationSecurity(HttpSecurity http) throws Exception {
        return http
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/",
                                "/index.html",
                                "/login",
                                "/accept-invite",
                                "/profile",
                                "/settings",
                                "/settings/**",
                                "/foods",
                                "/foods/**",
                                "/recipes",
                                "/recipes/**",
                                "/diary",
                                "/workouts",
                                "/workouts/**",
                                "/analytics",
                                "/analytics/**",
                                "/progress",
                                "/progress/**",
                                "/assets/**",
                                "/favicon.svg",
                                "/error",
                                "/actuator/health/**")
                        .permitAll()
                        .requestMatchers(
                                "/v3/api-docs/**",
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/actuator/info",
                                "/actuator/modulith",
                                "/actuator/modulith/**")
                        .hasRole("OWNER")
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/csrf")
                        .permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/invites/accept")
                        .permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/invites")
                        .hasRole("OWNER")
                        .anyRequest()
                        .authenticated())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation(fixation -> fixation.migrateSession()))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) -> writeProblem(
                                response, 401, "Não autenticado", "Autenticação necessária."))
                        .accessDeniedHandler((request, response, exception) -> writeProblem(
                                response, 403, "Acesso negado", "Você não possui permissão para esta operação.")))
                .headers(headers -> headers
                        .addHeaderWriter(new ContentSecurityPolicyHeaderWriter(
                                "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; "
                                        + "script-src 'self'; style-src 'self' 'unsafe-inline'; "
                                        + "img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; "
                                        + "form-action 'self'"))
                        .addHeaderWriter(new ReferrerPolicyHeaderWriter(ReferrerPolicy.NO_REFERRER))
                        .addHeaderWriter(new PermissionsPolicyHeaderWriter(
                                "accelerometer=(), autoplay=(), camera=(), display-capture=(), "
                                        + "encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), "
                                        + "magnetometer=(), microphone=(), midi=(), payment=(), "
                                        + "picture-in-picture=(), publickey-credentials-get=(), "
                                        + "screen-wake-lock=(), usb=()")))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }

    @Bean
    Clock applicationClock() {
        return Clock.systemUTC();
    }

    @Bean
    CookieSerializer sessionCookieSerializer(
            @Value("${server.servlet.session.cookie.secure:false}") boolean secure) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName("FORMETRIC_SESSION");
        serializer.setCookiePath("/");
        serializer.setUseHttpOnlyCookie(true);
        serializer.setUseSecureCookie(secure);
        serializer.setSameSite("Lax");
        return serializer;
    }

    private static void writeProblem(HttpServletResponse response, int status, String title, String detail)
            throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/problem+json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"title\":\"" + title + "\",\"status\":" + status
                + ",\"detail\":\"" + detail + "\"}");
    }
}

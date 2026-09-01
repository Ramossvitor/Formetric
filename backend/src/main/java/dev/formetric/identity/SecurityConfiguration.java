package dev.formetric.identity;

import jakarta.servlet.http.HttpServletResponse;
import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication.Type;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.header.writers.ContentSecurityPolicyHeaderWriter;
import org.springframework.security.web.header.writers.PermissionsPolicyHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration(proxyBeanMethods = false)
class SecurityConfiguration {

    /** The HTTP filter chain only applies when the application actually serves requests. */
    @Bean
    @ConditionalOnWebApplication(type = Type.SERVLET)
    SecurityFilterChain applicationSecurity(
            HttpSecurity http,
            CsrfTokenRepository csrfTokenRepository,
            AuthenticatedSessionIdentityProvider authenticatedSessionIdentityProvider)
            throws Exception {
        return http
                .csrf(csrf -> csrf.csrfTokenRepository(csrfTokenRepository))
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
                                "/more",
                                "/assets/**",
                                "/favicon.svg",
                                // Um navegador busca o manifesto e o service worker ANTES de haver
                                // sessão, e o registro do service worker é feito sem credenciais.
                                // Exigir autenticação aqui não protege nada — os dois arquivos são
                                // estáticos e iguais para todos — e impede a instalação do app.
                                "/manifest.webmanifest",
                                "/sw.js",
                                "/registerSW.js",
                                "/workbox-*.js",
                                "/icons/**",
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
                .requestCache(cache -> cache.disable())
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
                .addFilterBefore(
                        new AuthenticatedSessionRevalidationFilter(authenticatedSessionIdentityProvider),
                        AuthorizationFilter.class)
                .build();
    }

    @Bean
    CsrfTokenRepository csrfTokenRepository(
            @Value("${server.servlet.session.cookie.secure:false}") boolean secure) {
        CookieCsrfTokenRepository repository = new CookieCsrfTokenRepository();
        repository.setCookieName("XSRF-TOKEN");
        repository.setHeaderName("X-XSRF-TOKEN");
        repository.setCookieCustomizer(cookie -> cookie
                .path("/")
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax"));
        return repository;
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
            @Value("${server.servlet.session.cookie.secure:false}") boolean secure,
            @Value("${server.servlet.session.timeout}") Duration sessionTimeout) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName("FORMETRIC_SESSION");
        serializer.setCookiePath("/");
        serializer.setUseHttpOnlyCookie(true);
        serializer.setUseSecureCookie(secure);
        serializer.setSameSite("Lax");
        // Sem max-age o cookie é de sessão do navegador: ele desaparece ao fechar a aba, e o prazo
        // configurado no servidor nunca chega a valer. Num aplicativo instalado, que o sistema
        // descarta da memória a qualquer momento, isso significava pedir senha quase toda abertura.
        serializer.setCookieMaxAge((int) sessionTimeout.toSeconds());
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

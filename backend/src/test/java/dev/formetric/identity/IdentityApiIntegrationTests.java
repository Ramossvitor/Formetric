package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.formetric.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = {
        "formetric.bootstrap.admin-email=owner@formetric.dev",
        "formetric.bootstrap.admin-password=a-secure-owner-password",
        "formetric.bootstrap.admin-display-name=Formetric Owner",
        "server.servlet.session.cookie.secure=true"
})
@AutoConfigureMockMvc
class IdentityApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcClient jdbcClient;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private CsrfTokenRepository csrfTokenRepository;

    @Autowired
    private SecurityFilterChain securityFilterChain;

    @Test
    void anonymousCsrfBootstrapUsesAProtectedCookieWithoutCreatingAJdbcSession() throws Exception {
        assertThat(csrfTokenRepository).isInstanceOf(CookieCsrfTokenRepository.class);
        CsrfFilter csrfFilter = securityFilterChain.getFilters().stream()
                .filter(CsrfFilter.class::isInstance)
                .map(CsrfFilter.class::cast)
                .findFirst()
                .orElseThrow();
        assertThat(ReflectionTestUtils.getField(csrfFilter, "tokenRepository"))
                .isSameAs(csrfTokenRepository);
        long sessionsBefore = jdbcSessionCount();

        CsrfExchange csrf = fetchCsrf();

        assertThat(csrf.result().getResponse().getCookie("FORMETRIC_SESSION")).isNull();
        assertThat(jdbcSessionCount()).isEqualTo(sessionsBefore);
        assertThat(csrf.cookie().getName()).isEqualTo("XSRF-TOKEN");
        assertThat(csrf.cookie().getPath()).isEqualTo("/");
        assertThat(csrf.cookie().isHttpOnly()).isTrue();
        assertThat(csrf.cookie().getSecure()).isTrue();
        assertThat(csrf.cookie().getAttribute("SameSite")).isEqualTo("Lax");
        assertThat(csrf.cookie().getValue()).isNotEqualTo(csrf.token());
        assertThat(csrf.result().getResponse().getHeaders("Set-Cookie"))
                .anySatisfy(value -> assertThat(value)
                        .contains("XSRF-TOKEN=", "Path=/", "Secure", "HttpOnly"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(csrf.cookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"owner@formetric.dev","password":"a-secure-owner-password"}
                                """))
                .andExpect(status().isForbidden());
        assertThat(jdbcSessionCount()).isEqualTo(sessionsBefore);

        var rejectedLogin = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"owner@formetric.dev","password":"an-invalid-password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andReturn();
        assertThat(rejectedLogin.getResponse().getCookie("FORMETRIC_SESSION")).isNull();
        assertThat(jdbcSessionCount()).isEqualTo(sessionsBefore);
    }

    @Test
    void invitationAcceptanceLoginAuthorizationAndIsolationWorkEndToEnd() throws Exception {
        long sessionsBeforeAnonymousRequest = jdbcSessionCount();
        mockMvc.perform(get("/api/v1/auth/session"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));
        mockMvc.perform(get("/api/v1/profile/time-context"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        assertThat(jdbcSessionCount()).isEqualTo(sessionsBeforeAnonymousRequest);

        long sessionsBeforeLogin = jdbcSessionCount();
        CsrfExchange anonymousCsrf = fetchCsrf();

        var ownerLoginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(anonymousCsrf.cookie())
                        .header(anonymousCsrf.headerName(), anonymousCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":" OWNER@FORMETRIC.DEV ","password":"a-secure-owner-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.user.role").value("OWNER"))
                .andReturn();
        Cookie ownerCookie = requiredSessionCookie(ownerLoginResult);
        assertThat(jdbcSessionCount()).isEqualTo(sessionsBeforeLogin + 1);

        CsrfExchange reauthenticationCsrf = fetchCsrf(anonymousCsrf.cookie(), ownerCookie);
        var ownerReloginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(reauthenticationCsrf.cookie(), ownerCookie)
                        .header(reauthenticationCsrf.headerName(), reauthenticationCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"owner@formetric.dev","password":"a-secure-owner-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        Cookie rotatedOwnerCookie = requiredSessionCookie(ownerReloginResult);
        assertThat(rotatedOwnerCookie.getValue()).isNotEqualTo(ownerCookie.getValue());
        assertThat(jdbcSessionCount()).isEqualTo(sessionsBeforeLogin + 1);
        ownerCookie = rotatedOwnerCookie;

        String ownerId = responseText(mockMvc.perform(get("/api/v1/profile").cookie(ownerCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("owner@formetric.dev"))
                .andReturn(), "id");

        var inviteResult = mockMvc.perform(post("/api/v1/invites")
                        .cookie(ownerCookie, reauthenticationCsrf.cookie())
                        .header(reauthenticationCsrf.headerName(), reauthenticationCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":" Person@Example.com ","role":"USER","expiresInHours":24}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("person@example.com"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();
        String invitationToken = responseText(inviteResult, "token");

        String persistedTokenHash = jdbcClient.sql("SELECT token_hash FROM user_invites WHERE email = :email")
                .param("email", "person@example.com")
                .query(String.class)
                .single();
        assertThat(persistedTokenHash)
                .isEqualTo(IdentitySupport.hashToken(invitationToken))
                .doesNotContain(invitationToken);

        long sessionsBeforeAcceptance = jdbcSessionCount();
        CsrfExchange acceptanceCsrf = fetchCsrf();
        assertThat(jdbcSessionCount()).isEqualTo(sessionsBeforeAcceptance);

        mockMvc.perform(post("/api/v1/invites/accept")
                        .cookie(acceptanceCsrf.cookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AcceptInvitePayload(
                                invitationToken, "Pessoa Teste", "a-secure-user-password"))))
                .andExpect(status().isForbidden());
        assertThat(jdbcSessionCount()).isEqualTo(sessionsBeforeAcceptance);

        var userAcceptResult = mockMvc.perform(post("/api/v1/invites/accept")
                        .cookie(acceptanceCsrf.cookie())
                        .header(acceptanceCsrf.headerName(), acceptanceCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AcceptInvitePayload(
                                invitationToken, "Pessoa Teste", "a-secure-user-password"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.user.email").value("person@example.com"))
                .andExpect(jsonPath("$.user.role").value("USER"))
                .andReturn();
        Cookie userCookie = requiredSessionCookie(userAcceptResult);
        assertThat(jdbcSessionCount()).isEqualTo(sessionsBeforeAcceptance + 1);

        mockMvc.perform(post("/api/v1/invites/accept")
                        .cookie(acceptanceCsrf.cookie())
                        .header(acceptanceCsrf.headerName(), acceptanceCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AcceptInvitePayload(
                                invitationToken, "Outra Pessoa", "another-secure-password"))))
                .andExpect(status().isUnprocessableContent());

        mockMvc.perform(get("/api/v1/auth/session").cookie(userCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.displayName").value("Pessoa Teste"));

        mockMvc.perform(post("/api/v1/invites")
                        .cookie(userCookie, acceptanceCsrf.cookie())
                        .header(acceptanceCsrf.headerName(), acceptanceCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"forbidden@example.com","role":"USER","expiresInHours":24}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        String userId = responseText(mockMvc.perform(get("/api/v1/profile").cookie(userCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("person@example.com"))
                .andReturn(), "id");
        assertThat(userId).isNotEqualTo(ownerId);

        mockMvc.perform(patch("/api/v1/profile")
                        .cookie(userCookie, acceptanceCsrf.cookie())
                        .header(acceptanceCsrf.headerName(), acceptanceCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "displayName":"Nome Atualizado",
                                  "locale":"pt-BR",
                                  "timeZone":"UTC",
                                  "unitSystem":"METRIC",
                                  "birthDate":"1995-02-18",
                                  "formulaSex":"MALE"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Nome Atualizado"));

        var userTimeContext = mockMvc.perform(get("/api/v1/profile/time-context").cookie(userCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("UTC"))
                .andExpect(jsonPath("$.locale").value("pt-BR"))
                .andReturn();
        assertTemporalContext(userTimeContext.getResponse().getContentAsString(), "UTC");

        mockMvc.perform(get("/api/v1/profile").cookie(ownerCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ownerId))
                .andExpect(jsonPath("$.displayName").value("Formetric Owner"));
        var ownerTimeContext = mockMvc.perform(get("/api/v1/profile/time-context").cookie(ownerCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("America/Sao_Paulo"))
                .andReturn();
        assertTemporalContext(
                ownerTimeContext.getResponse().getContentAsString(), "America/Sao_Paulo");

        String hash = jdbcClient.sql("SELECT password_hash FROM user_accounts WHERE email = :email")
                .param("email", "person@example.com")
                .query(String.class)
                .single();
        assertThat(hash).startsWith("$argon2id$");
        assertThat(passwordEncoder.matches("a-secure-user-password", hash)).isTrue();

        mockMvc.perform(post("/api/v1/auth/logout")
                        .cookie(userCookie, acceptanceCsrf.cookie())
                        .header(acceptanceCsrf.headerName(), acceptanceCsrf.token()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/auth/session").cookie(userCookie))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validationErrorsUseProblemDetailsWithFieldErrors() throws Exception {
        CsrfExchange csrf = fetchCsrf();

        mockMvc.perform(post("/api/v1/invites/accept")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"","displayName":"x","password":"short"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Dados inválidos"))
                .andExpect(jsonPath("$.fieldErrors").isArray());

        mockMvc.perform(post("/api/v1/invites/accept")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token":"syntactically-valid-but-unknown-token",
                                  "displayName":" x ",
                                  "password":"a-secure-user-password"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("displayName"));
    }

    @Test
    void securityHeadersSecureCookiesAndPrivilegedOperationalEndpointsAreEnforced() throws Exception {
        mockMvc.perform(get("/login").header("X-Forwarded-Proto", "https"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        "Content-Security-Policy",
                        org.hamcrest.Matchers.containsString("script-src 'self'")))
                .andExpect(header().string(
                        "Content-Security-Policy",
                        org.hamcrest.Matchers.containsString("img-src 'self' data: blob:")))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string(
                        "Permissions-Policy",
                        org.hamcrest.Matchers.containsString("camera=()")));

        var secureCsrf = mockMvc.perform(get("/api/v1/auth/csrf")
                        .header("X-Forwarded-Proto", "https"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(requiredXsrfCookie(secureCsrf).getSecure()).isTrue();
        assertThat(secureCsrf.getResponse().getCookie("FORMETRIC_SESSION")).isNull();

        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
        for (String privilegedEndpoint : List.of("/v3/api-docs", "/actuator/info")) {
            mockMvc.perform(get(privilegedEndpoint))
                    .andExpect(status().isUnauthorized());
            mockMvc.perform(get(privilegedEndpoint).with(user("person").roles("USER")))
                    .andExpect(status().isForbidden());
            mockMvc.perform(get(privilegedEndpoint).with(user("owner").roles("OWNER")))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(get("/v3/api-docs").with(user("owner").roles("OWNER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/profile/time-context'].get").exists())
                .andExpect(jsonPath("$.components.schemas.TimeContextResponse.properties.serverNow").exists())
                .andExpect(jsonPath("$.components.schemas.TimeContextResponse.properties.today").exists())
                .andExpect(jsonPath("$.components.schemas.TimeContextResponse.properties.timeZone").exists())
                .andExpect(jsonPath("$.components.schemas.TimeContextResponse.properties.locale").exists())
                .andExpect(jsonPath("$.components.schemas.TimeContextResponse.properties.nextDayAt").exists())
                .andExpect(jsonPath("$.components.schemas.TimeContextResponse.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder(
                                "serverNow", "today", "timeZone", "locale", "nextDayAt")))
                .andExpect(jsonPath("$.components.schemas.CreateWaterRequest.properties.loggedAt").exists())
                .andExpect(jsonPath("$.components.schemas.CreateWaterRequest.required")
                        .value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("loggedAt"))));
        mockMvc.perform(get("/actuator/modulith"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/actuator/modulith").with(user("person").roles("USER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void spaDeepLinksRespectPublicAndAuthenticatedRoutes() throws Exception {
        mockMvc.perform(get("/login"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
        mockMvc.perform(get("/accept-invite").queryParam("token", "opaque"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));

        mockMvc.perform(get("/profile"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
        mockMvc.perform(get("/settings/security"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
        mockMvc.perform(get("/foods/new"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));

        Cookie ownerCookie = loginOwner();
        mockMvc.perform(get("/profile").cookie(ownerCookie))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
        mockMvc.perform(get("/settings/security").cookie(ownerCookie))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
        for (String clientRoute : List.of(
                "/foods/new",
                "/recipes/00000000-0000-0000-0000-000000000001",
                "/diary",
                "/workouts",
                "/workouts/00000000-0000-0000-0000-000000000001",
                "/analytics/monthly",
                "/analytics/charts",
                "/progress",
                "/progress/weight")) {
            mockMvc.perform(get(clientRoute).cookie(ownerCookie))
                    .andExpect(status().isOk())
                    .andExpect(forwardedUrl("/index.html"));
        }

        mockMvc.perform(get("/api/not-a-client-route"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/actuator/not-a-client-route"))
                .andExpect(status().isUnauthorized());
    }

    private String responseText(org.springframework.test.web.servlet.MvcResult result, String property) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .get(property)
                .stringValue();
    }

    private Cookie loginOwner() throws Exception {
        CsrfExchange csrf = fetchCsrf();
        return requiredSessionCookie(mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"owner@formetric.dev","password":"a-secure-owner-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn());
    }

    private CsrfExchange fetchCsrf(Cookie... requestCookies) throws Exception {
        var request = get("/api/v1/auth/csrf");
        if (requestCookies.length > 0) {
            request.cookie(requestCookies);
        }
        var result = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.headerName").value("X-XSRF-TOKEN"))
                .andReturn();
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        if (cookie == null) {
            cookie = java.util.Arrays.stream(requestCookies)
                    .filter(candidate -> candidate.getName().equals("XSRF-TOKEN"))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("Expected an XSRF-TOKEN cookie"));
        }
        assertThat(result.getResponse().getCookie("FORMETRIC_SESSION")).isNull();
        return new CsrfExchange(
                cookie,
                responseText(result, "token"),
                responseText(result, "headerName"),
                result);
    }

    private long jdbcSessionCount() {
        return jdbcClient.sql("SELECT COUNT(*) FROM spring_session")
                .query(Long.class)
                .single();
    }

    private void assertTemporalContext(String responseBody, String expectedTimeZone) throws Exception {
        var context = objectMapper.readTree(responseBody);
        Instant serverNow = Instant.parse(context.get("serverNow").asText());
        ZoneId timeZone = ZoneId.of(context.get("timeZone").asText());
        LocalDate today = LocalDate.parse(context.get("today").asText());
        Instant nextDayAt = Instant.parse(context.get("nextDayAt").asText());
        assertThat(timeZone.getId()).isEqualTo(expectedTimeZone);
        assertThat(today).isEqualTo(serverNow.atZone(timeZone).toLocalDate());
        assertThat(nextDayAt).isEqualTo(today.plusDays(1).atStartOfDay(timeZone).toInstant());
        assertThat(nextDayAt).isAfter(serverNow);
    }

    private static Cookie requiredXsrfCookie(org.springframework.test.web.servlet.MvcResult result) {
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/");
        return cookie;
    }

    private static Cookie requiredSessionCookie(org.springframework.test.web.servlet.MvcResult result) {
        Cookie cookie = result.getResponse().getCookie("FORMETRIC_SESSION");
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getSecure()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/");
        return cookie;
    }

    private record AcceptInvitePayload(String token, String displayName, String password) {
    }

    private record CsrfExchange(
            Cookie cookie,
            String token,
            String headerName,
            org.springframework.test.web.servlet.MvcResult result) {
    }
}

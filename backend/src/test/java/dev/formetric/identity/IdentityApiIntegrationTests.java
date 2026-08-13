package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
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
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = {
        "formetric.bootstrap.admin-email=owner@formetric.dev",
        "formetric.bootstrap.admin-password=a-secure-owner-password",
        "formetric.bootstrap.admin-display-name=Formetric Owner"
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

    @Test
    void invitationAcceptanceLoginAuthorizationAndIsolationWorkEndToEnd() throws Exception {
        mockMvc.perform(get("/api/v1/auth/session"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));

        var anonymousCsrfResult = mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andReturn();
        Cookie anonymousCookie = requiredSessionCookie(anonymousCsrfResult);
        String anonymousToken = responseText(anonymousCsrfResult, "token");

        var ownerLoginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(anonymousCookie)
                        .header("X-CSRF-TOKEN", anonymousToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":" OWNER@FORMETRIC.DEV ","password":"a-secure-owner-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.user.role").value("OWNER"))
                .andReturn();
        Cookie ownerCookie = requiredSessionCookie(ownerLoginResult);

        String ownerId = responseText(mockMvc.perform(get("/api/v1/profile").cookie(ownerCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("owner@formetric.dev"))
                .andReturn(), "id");

        var inviteResult = mockMvc.perform(post("/api/v1/invites")
                        .cookie(ownerCookie)
                        .with(csrf())
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

        var userAcceptResult = mockMvc.perform(post("/api/v1/invites/accept")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AcceptInvitePayload(
                                invitationToken, "Pessoa Teste", "a-secure-user-password"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.user.email").value("person@example.com"))
                .andExpect(jsonPath("$.user.role").value("USER"))
                .andReturn();
        Cookie userCookie = requiredSessionCookie(userAcceptResult);

        mockMvc.perform(post("/api/v1/invites/accept")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AcceptInvitePayload(
                                invitationToken, "Outra Pessoa", "another-secure-password"))))
                .andExpect(status().isUnprocessableContent());

        mockMvc.perform(get("/api/v1/auth/session").cookie(userCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.displayName").value("Pessoa Teste"));

        mockMvc.perform(post("/api/v1/invites")
                        .cookie(userCookie)
                        .with(csrf())
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
                        .cookie(userCookie)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "displayName":"Nome Atualizado",
                                  "locale":"pt-BR",
                                  "timeZone":"America/Sao_Paulo",
                                  "unitSystem":"METRIC",
                                  "birthDate":"1995-02-18",
                                  "formulaSex":"MALE"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Nome Atualizado"));

        mockMvc.perform(get("/api/v1/profile").cookie(ownerCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ownerId))
                .andExpect(jsonPath("$.displayName").value("Formetric Owner"));

        String hash = jdbcClient.sql("SELECT password_hash FROM user_accounts WHERE email = :email")
                .param("email", "person@example.com")
                .query(String.class)
                .single();
        assertThat(hash).startsWith("$argon2id$");
        assertThat(passwordEncoder.matches("a-secure-user-password", hash)).isTrue();

        mockMvc.perform(post("/api/v1/auth/logout").cookie(userCookie).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/auth/session").cookie(userCookie))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validationErrorsUseProblemDetailsWithFieldErrors() throws Exception {
        mockMvc.perform(post("/api/v1/invites/accept")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"","displayName":"x","password":"short"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Dados inválidos"))
                .andExpect(jsonPath("$.fieldErrors").isArray());
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
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/settings/security"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/foods/new"))
                .andExpect(status().isUnauthorized());

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
        var csrfResult = mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();
        return requiredSessionCookie(mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(requiredSessionCookie(csrfResult))
                        .header("X-CSRF-TOKEN", responseText(csrfResult, "token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"owner@formetric.dev","password":"a-secure-owner-password"}
                                """))
                .andExpect(status().isOk())
                .andReturn());
    }

    private static Cookie requiredSessionCookie(org.springframework.test.web.servlet.MvcResult result) {
        Cookie cookie = result.getResponse().getCookie("FORMETRIC_SESSION");
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/");
        return cookie;
    }

    private record AcceptInvitePayload(String token, String displayName, String password) {
    }
}

package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.formetric.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = {
        "formetric.bootstrap.admin-email=owner@formetric.dev",
        "formetric.bootstrap.admin-password=a-secure-owner-password",
        "formetric.bootstrap.admin-display-name=Formetric Owner",
        "server.servlet.session.cookie.secure=true"
})
@AutoConfigureMockMvc
class AuthenticatedSessionRevalidationIntegrationTests {

    private static final String SHARED_TEST_PASSWORD = "a-secure-owner-password";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcClient jdbcClient;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SecurityFilterChain securityFilterChain;

    @MockitoSpyBean
    private AuthenticatedSessionIdentityProvider identityProvider;

    @Test
    void revalidationRunsExactlyOnceInsideTheSecurityChainBeforeAuthorization() {
        var filters = securityFilterChain.getFilters();
        long revalidationFilterCount = filters.stream()
                .filter(AuthenticatedSessionRevalidationFilter.class::isInstance)
                .count();
        int revalidationIndex = indexOf(filters, AuthenticatedSessionRevalidationFilter.class);
        int authorizationIndex = indexOf(filters, AuthorizationFilter.class);

        assertThat(revalidationFilterCount).isEqualTo(1);
        assertThat(revalidationIndex).isNotNegative().isLessThan(authorizationIndex);
    }

    @Test
    void anAnonymousRequestDoesNotRevalidateAnIdentityOrCreateASession() throws Exception {
        clearInvocations(identityProvider);
        long sessionsBefore = jdbcSessionCount();

        mockMvc.perform(get("/api/v1/auth/session"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        verifyNoInteractions(identityProvider);
        assertThat(jdbcSessionCount()).isEqualTo(sessionsBefore);
    }

    @Test
    void disablingAnAccountRevokesItsExistingSessionImmediately() throws Exception {
        TestAccount account = createAccount(UserRole.USER, "disabled-session");
        try {
            AuthenticatedExchange exchange = login(account.email());
            assertThat(sessionCountFor(account.email())).isEqualTo(1);

            jdbcClient.sql("UPDATE user_accounts SET status = 'DISABLED' WHERE id = :id")
                    .param("id", account.id())
                    .update();

            mockMvc.perform(get("/api/v1/profile").cookie(exchange.sessionCookie()))
                    .andExpect(status().isUnauthorized())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.detail").value("A sessão não é mais válida."));

            assertThat(sessionCountFor(account.email())).isZero();
            mockMvc.perform(get("/api/v1/profile").cookie(exchange.sessionCookie()))
                    .andExpect(status().isUnauthorized());
        } finally {
            deleteAccount(account);
        }
    }

    @Test
    void refreshedRoleAndProfileReachAuthorizationAndPersistInTheSameSession() throws Exception {
        TestAccount account = createAccount(UserRole.OWNER, "refreshed-session");
        String refreshedEmail = "refreshed-" + account.id() + "@example.test";
        try {
            AuthenticatedExchange exchange = login(account.email());

            jdbcClient.sql("""
                            UPDATE user_accounts
                               SET email = :email, role = 'USER', updated_at = CURRENT_TIMESTAMP
                             WHERE id = :id
                            """)
                    .param("email", refreshedEmail)
                    .param("id", account.id())
                    .update();
            jdbcClient.sql("""
                            UPDATE user_profiles
                               SET display_name = 'Nome Atualizado na Sessão', updated_at = CURRENT_TIMESTAMP
                             WHERE user_id = :id
                            """)
                    .param("id", account.id())
                    .update();

            mockMvc.perform(post("/api/v1/invites")
                            .cookie(exchange.sessionCookie(), exchange.csrfCookie())
                            .header(exchange.csrfHeaderName(), exchange.csrfToken())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"email":"should-not-exist@example.test","role":"USER","expiresInHours":24}
                                    """))
                    .andExpect(status().isForbidden());

            mockMvc.perform(get("/api/v1/auth/session").cookie(exchange.sessionCookie()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.user.email").value(refreshedEmail))
                    .andExpect(jsonPath("$.user.displayName").value("Nome Atualizado na Sessão"))
                    .andExpect(jsonPath("$.user.role").value("USER"));

            assertThat(sessionCountFor(account.email())).isZero();
            assertThat(sessionCountFor(refreshedEmail)).isEqualTo(1);
            assertThat(jdbcClient.sql("SELECT COUNT(*) FROM user_invites WHERE email = :email")
                            .param("email", "should-not-exist@example.test")
                            .query(Long.class)
                            .single())
                    .isZero();
        } finally {
            deleteSession(refreshedEmail);
            deleteAccount(account);
        }
    }

    private AuthenticatedExchange login(String email) throws Exception {
        var csrfResult = mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie csrfCookie = requiredCookie(csrfResult, "XSRF-TOKEN");
        String csrfToken = responseText(csrfResult, "token");
        String csrfHeaderName = responseText(csrfResult, "headerName");

        var loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(csrfCookie)
                        .header(csrfHeaderName, csrfToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginPayload(email, SHARED_TEST_PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        return new AuthenticatedExchange(
                requiredCookie(loginResult, "FORMETRIC_SESSION"),
                csrfCookie,
                csrfToken,
                csrfHeaderName);
    }

    private TestAccount createAccount(UserRole role, String prefix) {
        UUID id = UUID.randomUUID();
        String email = prefix + "-" + id + "@example.test";
        String sharedPasswordHash = jdbcClient.sql("""
                        SELECT password_hash FROM user_accounts WHERE email = 'owner@formetric.dev'
                        """)
                .query(String.class)
                .single();
        jdbcClient.sql("""
                        INSERT INTO user_accounts
                            (id, email, password_hash, role, status, created_at, updated_at)
                        VALUES
                            (:id, :email, :passwordHash, :role, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """)
                .param("id", id)
                .param("email", email)
                .param("passwordHash", sharedPasswordHash)
                .param("role", role.name())
                .update();
        jdbcClient.sql("""
                        INSERT INTO user_profiles
                            (user_id, display_name, locale, time_zone, unit_system, created_at, updated_at)
                        VALUES
                            (:id, 'Session Test User', 'pt-BR', 'America/Sao_Paulo', 'METRIC',
                             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """)
                .param("id", id)
                .update();
        return new TestAccount(id, email);
    }

    private void deleteAccount(TestAccount account) {
        deleteSession(account.email());
        jdbcClient.sql("DELETE FROM user_invites WHERE created_by = :id")
                .param("id", account.id())
                .update();
        jdbcClient.sql("DELETE FROM user_accounts WHERE id = :id")
                .param("id", account.id())
                .update();
    }

    private void deleteSession(String principalName) {
        jdbcClient.sql("DELETE FROM spring_session WHERE principal_name = :principalName")
                .param("principalName", principalName)
                .update();
    }

    private long jdbcSessionCount() {
        return jdbcClient.sql("SELECT COUNT(*) FROM spring_session")
                .query(Long.class)
                .single();
    }

    private long sessionCountFor(String principalName) {
        return jdbcClient.sql("SELECT COUNT(*) FROM spring_session WHERE principal_name = :principalName")
                .param("principalName", principalName)
                .query(Long.class)
                .single();
    }

    private String responseText(org.springframework.test.web.servlet.MvcResult result, String property) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .get(property)
                .stringValue();
    }

    private static Cookie requiredCookie(org.springframework.test.web.servlet.MvcResult result, String name) {
        Cookie cookie = result.getResponse().getCookie(name);
        assertThat(cookie).as("response cookie %s", name).isNotNull();
        return cookie;
    }

    private static int indexOf(
            java.util.List<jakarta.servlet.Filter> filters,
            Class<? extends jakarta.servlet.Filter> filterType) {
        for (int index = 0; index < filters.size(); index++) {
            if (filterType.isInstance(filters.get(index))) {
                return index;
            }
        }
        return -1;
    }

    private record LoginPayload(String email, String password) {
    }

    private record AuthenticatedExchange(
            Cookie sessionCookie,
            Cookie csrfCookie,
            String csrfToken,
            String csrfHeaderName) {
    }

    private record TestAccount(UUID id, String email) {
    }
}

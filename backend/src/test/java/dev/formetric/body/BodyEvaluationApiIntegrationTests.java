package dev.formetric.body;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.formetric.TestcontainersConfiguration;
import dev.formetric.identity.AuthenticatedUser;
import dev.formetric.identity.CurrentUserProvider;
import dev.formetric.identity.UserRole;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BodyEvaluationApiIntegrationTests {

    private static final UUID USER_ONE = UUID.fromString("61000000-0000-0000-0000-000000000001");
    private static final UUID USER_TWO = UUID.fromString("62000000-0000-0000-0000-000000000002");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private CurrentUserProvider currentUserProvider;

    @BeforeEach
    void prepareUsers() {
        jdbcTemplate.update("DELETE FROM user_accounts");
        createUser(USER_ONE, "body-api-one@example.test");
        createUser(USER_TWO, "body-api-two@example.test");
        authenticate(USER_ONE);
    }

    @Test
    @WithMockUser(username = "body-user")
    void contractEnforcesCsrfVersioningArchivalAndUserIsolation() throws Exception {
        String createBody = evaluationBody("2026-07-01", "Avaliação inicial", "20");
        mockMvc.perform(post("/api/v1/body-evaluations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        var createdResult = mockMvc.perform(post("/api/v1/body-evaluations")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.currentVersion.versionNumber").value(1))
                .andExpect(jsonPath("$.currentVersion.results[?(@.provenance == 'REPORTED')]").isNotEmpty())
                .andReturn();
        var created = objectMapper.readTree(createdResult.getResponse().getContentAsByteArray());
        String evaluationId = created.get("id").asText();
        String baselineVersionId = created.get("currentVersion").get("id").asText();

        mockMvc.perform(get("/api/v1/body-evaluations")
                        .queryParam("from", "2026-01-01")
                        .queryParam("to", "2026-12-31")
                        .queryParam("archiveStatus", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(evaluationId));

        String versionBody = """
                {
                  "expectedCurrentVersionNumber": 1,
                  "assessmentDate": "2026-08-01",
                  "title": "Avaliação de retorno",
                  "source": "PROFESSIONAL",
                  "assessorName": "Profissional",
                  "notes": null,
                  "weightKg": 88,
                  "heightCm": 180,
                  "ageYears": 30,
                  "formulaSex": "MALE",
                  "protocol": "NONE",
                  "reportedMethodType": "BIOIMPEDANCE",
                  "reportedMethodLabel": "Aparelho X",
                  "circumferences": [{"site":"WAIST","valueCm":86}],
                  "skinfolds": [],
                  "reportedResults": [{"metric":"BODY_FAT_PERCENT","value":18,"reportedLabel":"Laudo"}]
                }
                """;
        var versionResult = mockMvc.perform(post("/api/v1/body-evaluations/{id}/versions", evaluationId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(versionBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versions.length()").value(2))
                .andReturn();
        var versioned = objectMapper.readTree(versionResult.getResponse().getContentAsByteArray());
        String followUpVersionId = versioned.get("currentVersion").get("id").asText();
        long identityVersion = versioned.get("identityVersion").asLong();

        mockMvc.perform(get("/api/v1/body-evaluations/comparison")
                        .queryParam("baselineVersionId", baselineVersionId)
                        .queryParam("followUpVersionId", followUpVersionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.daysBetween").value(31))
                .andExpect(jsonPath("$.weightDeltaKg").value(-2))
                .andExpect(jsonPath("$.circumferenceDeltas[0].deltaCm").value(-4));

        var archivedResult = mockMvc.perform(post("/api/v1/body-evaluations/{id}/archive", evaluationId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedIdentityVersion\":" + identityVersion + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true))
                .andReturn();
        long archivedIdentityVersion = objectMapper.readTree(archivedResult.getResponse().getContentAsByteArray())
                .get("identityVersion").asLong();

        mockMvc.perform(delete("/api/v1/body-evaluations/{id}/archive", evaluationId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedIdentityVersion\":" + archivedIdentityVersion + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(false));

        authenticate(USER_TWO);
        mockMvc.perform(get("/api/v1/body-evaluations/{id}", evaluationId))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("BODY_EVALUATION_NOT_FOUND"));
        mockMvc.perform(get("/api/v1/body-evaluations/comparison")
                        .queryParam("baselineVersionId", baselineVersionId)
                        .queryParam("followUpVersionId", followUpVersionId))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "body-user")
    void invalidPrecisionDuplicateReportedMetricsAndChronologyReturnProblemDetails() throws Exception {
        mockMvc.perform(post("/api/v1/body-evaluations")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(evaluationBody("2026-07-01", "Inválida", "20.123456789")))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        String duplicates = evaluationBody("2026-07-01", "Duplicada", "20")
                .replace(
                        "{\"metric\":\"BODY_FAT_PERCENT\",\"value\":20,\"reportedLabel\":\"Laudo\"}",
                        "{\"metric\":\"BODY_FAT_PERCENT\",\"value\":20,\"reportedLabel\":\"Laudo\"},"
                                + "{\"metric\":\"BODY_FAT_PERCENT\",\"value\":21,\"reportedLabel\":null}");
        mockMvc.perform(post("/api/v1/body-evaluations")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(duplicates))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BODY_EVALUATION_VALIDATION"));

        mockMvc.perform(get("/api/v1/body-evaluations")
                        .queryParam("from", "2026-12-31")
                        .queryParam("to", "2026-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BODY_EVALUATION_VALIDATION"));

        mockMvc.perform(post("/api/v1/body-evaluations")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(evaluationBody("2026-07-01", "Altura inválida", "20")
                                .replace("\"heightCm\": 180", "\"heightCm\": 29.999")))
                .andExpect(status().isBadRequest());
    }

    private static String evaluationBody(String date, String title, String bodyFat) {
        return """
                {
                  "assessmentDate": "%s",
                  "title": "%s",
                  "source": "PROFESSIONAL",
                  "assessorName": "Profissional",
                  "notes": null,
                  "weightKg": 90,
                  "heightCm": 180,
                  "ageYears": 30,
                  "formulaSex": "MALE",
                  "protocol": "NONE",
                  "reportedMethodType": "BIOIMPEDANCE",
                  "reportedMethodLabel": "Aparelho X",
                  "circumferences": [{"site":"WAIST","valueCm":90}],
                  "skinfolds": [],
                  "reportedResults": [{"metric":"BODY_FAT_PERCENT","value":%s,"reportedLabel":"Laudo"}]
                }
                """.formatted(date, title, bodyFat);
    }

    private void authenticate(UUID userId) {
        when(currentUserProvider.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(userId, userId + "@example.test", "Body User", UserRole.USER));
    }

    private void createUser(UUID userId, String email) {
        jdbcTemplate.update("""
                INSERT INTO user_accounts
                    (id, email, password_hash, role, status, created_at, updated_at)
                VALUES (?, ?, 'test-only', 'USER', 'ACTIVE', now(), now())
                """, userId, email);
    }
}

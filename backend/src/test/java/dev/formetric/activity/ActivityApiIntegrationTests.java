package dev.formetric.activity;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class ActivityApiIntegrationTests {

    private static final UUID USER_ONE = UUID.fromString("41000000-0000-0000-0000-000000000001");
    private static final UUID USER_TWO = UUID.fromString("42000000-0000-0000-0000-000000000002");

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
        createUser(USER_ONE, "activity-one@example.test");
        createUser(USER_TWO, "activity-two@example.test");
        authenticate(USER_ONE);
    }

    @Test
    @WithMockUser(username = "activity-user")
    void authenticatedWorkoutContractEnforcesCsrfCrudIsolationAndProblemDetails() throws Exception {
        String createBody = """
                {
                  "requestId": "43000000-0000-0000-0000-000000000003",
                  "date": "2026-08-13",
                  "modality": "STRENGTH",
                  "customModality": null,
                  "title": "Peito e biceps",
                  "muscleGroups": ["Peito", "Biceps"],
                  "startTime": "18:30:00",
                  "durationMinutes": 70,
                  "estimatedKcal": 450,
                  "notes": "Progressao consistente"
                }
                """;

        mockMvc.perform(post("/api/v1/workouts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        var createdResult = mockMvc.perform(post("/api/v1/workouts")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.modality").value("STRENGTH"))
                .andExpect(jsonPath("$.durationMinutes").value(70))
                .andReturn();
        var created = objectMapper.readTree(createdResult.getResponse().getContentAsByteArray());
        String workoutId = created.get("id").asText();
        long version = created.get("version").asLong();

        mockMvc.perform(get("/api/v1/workouts")
                        .queryParam("from", "2026-08-01")
                        .queryParam("to", "2026-08-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(workoutId));
        mockMvc.perform(get("/api/v1/workouts/{id}", workoutId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Peito e biceps"));

        mockMvc.perform(put("/api/v1/workouts/{id}", workoutId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "date": "2026-08-13",
                                  "modality": "STRENGTH",
                                  "customModality": null,
                                  "title": "Peito e triceps",
                                  "muscleGroups": ["Peito", "Triceps"],
                                  "startTime": "18:30:00",
                                  "durationMinutes": 75,
                                  "estimatedKcal": 475,
                                  "notes": null,
                                  "version": %d
                                }
                                """.formatted(version)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Peito e triceps"))
                .andExpect(jsonPath("$.version").value(version + 1));

        authenticate(USER_TWO);
        mockMvc.perform(get("/api/v1/workouts/{id}", workoutId))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));

        mockMvc.perform(get("/api/v1/workouts")
                        .queryParam("from", "2020-02-29")
                        .queryParam("to", "2025-02-28"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("ACTIVITY_VALIDATION"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("to"));

        authenticate(USER_ONE);
        mockMvc.perform(delete("/api/v1/workouts/{id}", workoutId).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/workouts/{id}", workoutId))
                .andExpect(status().isNotFound());
    }

    private void authenticate(UUID userId) {
        when(currentUserProvider.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(userId, userId + "@example.test", "Activity User", UserRole.USER));
    }

    private void createUser(UUID userId, String email) {
        jdbcTemplate.update("""
                INSERT INTO user_accounts
                    (id, email, password_hash, role, status, created_at, updated_at)
                VALUES (?, ?, 'test-only', 'USER', 'ACTIVE', now(), now())
                """, userId, email);
    }
}

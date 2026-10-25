package com.edtech.tutor.tutor.api;

import static com.edtech.tutor.SeedData.ANA;
import static com.edtech.tutor.SeedData.BRUNO;
import static com.edtech.tutor.SeedData.COURSE;
import static com.edtech.tutor.SeedData.LESSON_1;
import static com.edtech.tutor.SeedData.LESSON_2;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.edtech.tutor.IntegrationTest;
import com.edtech.tutor.TestTokens;
import com.edtech.tutor.tutor.infra.MockLlmAdapter;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@IntegrationTest
class TutorApiTests {

    /** Segunda alumna matriculada, creada solo para este test: comparte lección con Ana. */
    static final UUID CARLA = UUID.fromString("a1b2c3d4-0000-4000-8000-0000000000c3");

    @Autowired MockMvc mvc;
    @Autowired JwtEncoder jwtEncoder;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void enrollCarla() {
        jdbc.update("INSERT INTO student (id, email, password_hash, display_name) VALUES (?, 'carla@test', 'x', 'Carla')", CARLA);
        jdbc.update("INSERT INTO enrollment (student_id, course_id) VALUES (?, ?)", CARLA, COURSE);
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM conversation");
        jdbc.update("DELETE FROM student WHERE id = ?", CARLA);
    }

    // --- Recorrido principal ------------------------------------------------------------------

    @Test
    void groundedAnswerIsReturnedAndBothMessagesArePersisted() throws Exception {
        ask(ANA, LESSON_2, "¿Para qué sirve POST?", "VOICE")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.question.role").value("STUDENT"))
                .andExpect(jsonPath("$.question.content").value("¿Para qué sirve POST?"))
                .andExpect(jsonPath("$.question.inputMode").value("VOICE"))
                .andExpect(jsonPath("$.question.grounded").doesNotExist())
                .andExpect(jsonPath("$.answer.role").value("TUTOR"))
                .andExpect(jsonPath("$.answer.grounded").value(true))
                .andExpect(jsonPath("$.answer.content", containsString("crear un nuevo recurso")))
                .andExpect(jsonPath("$.answer.citation", containsString("crear")))
                .andExpect(jsonPath("$.answer.id").isString())
                .andExpect(jsonPath("$.answer.createdAt").isString());

        history(ANA, LESSON_2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].role").value("STUDENT"))
                .andExpect(jsonPath("$[1].role").value("TUTOR"));
    }

    @Test
    void offTopicQuestionIsAnsweredAsNotGrounded() throws Exception {
        ask(ANA, LESSON_2, "¿Cuál es la capital de Francia?", "TEXT")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.answer.grounded").value(false))
                .andExpect(jsonPath("$.answer.citation").doesNotExist())
                .andExpect(jsonPath("$.answer.content", startsWith("No encuentro información suficiente")));
    }

    @Test
    void historyKeepsChronologicalOrderAcrossSeveralQuestions() throws Exception {
        ask(ANA, LESSON_2, "¿Qué hace GET?", "TEXT").andExpect(status().isCreated());
        ask(ANA, LESSON_2, "¿Y DELETE?", "VOICE").andExpect(status().isCreated());

        history(ANA, LESSON_2)
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].content").value("¿Qué hace GET?"))
                .andExpect(jsonPath("$[2].content").value("¿Y DELETE?"))
                .andExpect(jsonPath("$[2].inputMode").value("VOICE"));
    }

    @Test
    void historyIsSeparatedPerLesson() throws Exception {
        ask(ANA, LESSON_2, "¿Qué hace GET?", "TEXT").andExpect(status().isCreated());

        history(ANA, LESSON_1).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
    }

    // --- Aislamiento entre alumnos (IDOR) -----------------------------------------------------

    @Test
    void anotherEnrolledStudentNeverSeesSomeoneElsesMessages() throws Exception {
        ask(ANA, LESSON_2, "¿Para qué sirve POST? (pregunta privada de Ana)", "TEXT").andExpect(status().isCreated());

        var carlaHistory = history(CARLA, LESSON_2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)))
                .andReturn().getResponse().getContentAsString();
        assertThat(carlaHistory).doesNotContain("privada de Ana");

        ask(CARLA, LESSON_2, "¿Qué hace GET?", "TEXT").andExpect(status().isCreated());
        history(ANA, LESSON_2).andExpect(jsonPath("$", hasSize(2)));
        history(CARLA, LESSON_2).andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].content").value("¿Qué hace GET?"));
    }

    @Test
    void studentWithoutAccessCannotReadOrWriteMessages() throws Exception {
        ask(ANA, LESSON_2, "¿Para qué sirve POST?", "TEXT").andExpect(status().isCreated());

        history(BRUNO, LESSON_2).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        ask(BRUNO, LESSON_2, "¿Para qué sirve POST?", "TEXT").andExpect(status().isNotFound());

        assertThat(jdbc.queryForObject("SELECT count(*) FROM conversation WHERE student_id = ?", Integer.class, BRUNO))
                .isZero();
    }

    @Test
    void unknownLessonReturns404() throws Exception {
        ask(ANA, UUID.randomUUID(), "Hola", "TEXT").andExpect(status().isNotFound());
    }

    // --- Validación y errores -----------------------------------------------------------------

    @Test
    void invalidQuestionsAreRejected() throws Exception {
        ask(ANA, LESSON_2, "   ", "TEXT")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fields.content").exists());
        ask(ANA, LESSON_2, "a".repeat(2001), "TEXT")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.content").exists());
        ask(ANA, LESSON_2, "Hola", "TELEPATIA")
                .andExpect(status().isBadRequest());
    }

    @Test
    void aiOutageReturns503AndLeavesHistoryUntouched() throws Exception {
        ask(ANA, LESSON_2, "¿Qué hace GET?", "TEXT").andExpect(status().isCreated());

        ask(ANA, LESSON_2, "Pregunta " + MockLlmAdapter.FAILURE_TRIGGER, "TEXT")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"));

        history(ANA, LESSON_2).andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void htmlInQuestionIsStoredAsPlainText() throws Exception {
        var payload = "<img src=x onerror=alert(1)> ¿Qué es POST?";

        ask(ANA, LESSON_2, payload, "TEXT")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.question.content").value(payload));
    }

    // --- helpers -----------------------------------------------------------------------------

    private ResultActions ask(UUID studentId, UUID lessonId, String content, String inputMode) throws Exception {
        var body = """
                {"content":%s,"inputMode":"%s"}""".formatted(jsonString(content), inputMode);
        return mvc.perform(post("/api/lessons/{id}/messages", lessonId)
                .header(HttpHeaders.AUTHORIZATION, TestTokens.bearer(jwtEncoder, studentId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private ResultActions history(UUID studentId, UUID lessonId) throws Exception {
        return mvc.perform(get("/api/lessons/{id}/messages", lessonId)
                .header(HttpHeaders.AUTHORIZATION, TestTokens.bearer(jwtEncoder, studentId)));
    }

    private static String jsonString(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}

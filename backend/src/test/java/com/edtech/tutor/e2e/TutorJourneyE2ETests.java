package com.edtech.tutor.e2e;

import static com.edtech.tutor.SeedData.LESSON_2;
import static org.assertj.core.api.Assertions.assertThat;

import com.edtech.tutor.TestcontainersConfiguration;
import com.edtech.tutor.speech.TestAudio;
import com.edtech.tutor.speech.infra.MockTranscriptionAdapter;
import com.edtech.tutor.tutor.infra.MockLlmAdapter;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

/**
 * E2E de API: servidor real en puerto aleatorio + PostgreSQL real + LLM y voz mock. Recorre por HTTP el flujo del
 * enunciado tal como lo hará el frontend: login → curso → lección → voz → transcripción → preguntas → volver más
 * tarde → historial,
 * y comprueba que una cuenta sin acceso no ve ni la lección ni los mensajes.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class TutorJourneyE2ETests {

    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;

    RestClient http;

    @BeforeEach
    void setUp() {
        http = RestClient.builder()
                .baseUrl("http://localhost:" + port)
                .defaultStatusHandler(status -> true, (request, response) -> {
                })
                .build();
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM conversation");
    }

    @Test
    void authorizedStudentAsksTheTutorAndRecoversTheConversationLater() {
        // 1. Login
        var token = login("ana.garcia@demo.edtech");

        // 2. Mis cursos → primera lección
        var courses = get("/api/courses", token);
        assertThat(courses.getStatusCode().value()).isEqualTo(200);
        String courseId = JsonPath.read(courses.getBody(), "$[0].id");

        // 3. Temario → lección 2 (Métodos HTTP)
        var course = get("/api/courses/" + courseId, token);
        String lessonId = JsonPath.read(course.getBody(), "$.lessons[1].id");
        assertThat(lessonId).isEqualTo(LESSON_2.toString());

        var lesson = get("/api/lessons/" + lessonId, token);
        assertThat(lesson.getStatusCode().value()).isEqualTo(200);
        assertThat((String) JsonPath.read(lesson.getBody(), "$.content")).contains("POST");

        // 4. Pregunta por voz (ya transcrita) con respuesta basada en la lección
        var grounded = ask(lessonId, token, "¿Para qué sirve POST?", "VOICE");
        assertThat(grounded.getStatusCode().value()).isEqualTo(201);
        assertThat((Boolean) JsonPath.read(grounded.getBody(), "$.answer.grounded")).isTrue();
        assertThat((String) JsonPath.read(grounded.getBody(), "$.answer.content")).contains("crear un nuevo recurso");

        // 5. Pregunta fuera del temario: el tutor indica que no tiene información suficiente
        var offTopic = ask(lessonId, token, "¿Quién ganó el mundial de 2010?", "TEXT");
        assertThat((Boolean) JsonPath.read(offTopic.getBody(), "$.answer.grounded")).isFalse();

        // 6. Fallo del servicio de IA: error recuperable, no se pierde ni ensucia el historial
        var outage = ask(lessonId, token, "Otra pregunta " + MockLlmAdapter.FAILURE_TRIGGER, "TEXT");
        assertThat(outage.getStatusCode().value()).isEqualTo(503);
        assertThat((String) JsonPath.read(outage.getBody(), "$.code")).isEqualTo("AI_UNAVAILABLE");

        // 7. "Al regresar": nueva sesión (nuevo login) y se recupera la conversación completa y ordenada
        var laterToken = login("ana.garcia@demo.edtech");
        var history = get("/api/lessons/" + lessonId + "/messages", laterToken);
        assertThat(history.getStatusCode().value()).isEqualTo(200);
        List<Map<String, Object>> messages = JsonPath.read(history.getBody(), "$");
        assertThat(messages).extracting(m -> m.get("role"))
                .containsExactly("STUDENT", "TUTOR", "STUDENT", "TUTOR");
        assertThat(messages.get(0)).containsEntry("content", "¿Para qué sirve POST?").containsEntry("inputMode", "VOICE");
        assertThat(messages.get(3)).containsEntry("grounded", false);
    }

    @Test
    void accountWithoutAccessCannotSeeTheLessonNorAnotherStudentsMessages() {
        var anaToken = login("ana.garcia@demo.edtech");
        ask(LESSON_2.toString(), anaToken, "Pregunta privada de Ana sobre POST", "TEXT");

        var brunoToken = login("bruno.lopez@demo.edtech");

        var courses = get("/api/courses", brunoToken);
        assertThat(courses.getBody()).isEqualTo("[]");

        var lesson = get("/api/lessons/" + LESSON_2, brunoToken);
        assertThat(lesson.getStatusCode().value()).isEqualTo(404);
        assertThat(lesson.getBody()).doesNotContain("POST");

        var messages = get("/api/lessons/" + LESSON_2 + "/messages", brunoToken);
        assertThat(messages.getStatusCode().value()).isEqualTo(404);
        assertThat(messages.getBody()).doesNotContain("privada de Ana");

        var write = ask(LESSON_2.toString(), brunoToken, "¿Para qué sirve POST?", "TEXT");
        assertThat(write.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void withoutTokenNothingIsAccessible() {
        var response = http.get().uri("/api/lessons/" + LESSON_2 + "/messages").retrieve().toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE)).startsWith("Bearer");
    }

    @Test
    void voiceQuestionIsTranscribedReviewedAndSentToTheTutor() {
        var token = login("ana.garcia@demo.edtech");

        // 1. El navegador sube la grabación (MediaRecorder → webm/opus)
        var transcription = transcribe(token, TestAudio.webm(16 * 1024));
        assertThat(transcription.getStatusCode().value()).isEqualTo(200);
        String text = JsonPath.read(transcription.getBody(), "$.text");
        assertThat(text).isEqualTo(MockTranscriptionAdapter.SAMPLE_TRANSCRIPT);

        // 2. El alumno revisa (puede editar) y envía el texto como pregunta por voz
        var answer = ask(LESSON_2.toString(), token, text, "VOICE");
        assertThat(answer.getStatusCode().value()).isEqualTo(201);
        assertThat((String) JsonPath.read(answer.getBody(), "$.question.inputMode")).isEqualTo("VOICE");
        assertThat((Boolean) JsonPath.read(answer.getBody(), "$.answer.grounded")).isTrue();
    }

    @Test
    void voiceErrorsAreRecoverableAndExplained() {
        var token = login("ana.garcia@demo.edtech");

        var tooLarge = transcribe(token, TestAudio.webm(7 * 1024 * 1024));
        assertThat(tooLarge.getStatusCode().value()).isEqualTo(413);
        assertThat((String) JsonPath.read(tooLarge.getBody(), "$.code")).isEqualTo("AUDIO_TOO_LARGE");

        var notAudio = transcribe(token, TestAudio.png(16 * 1024));
        assertThat(notAudio.getStatusCode().value()).isEqualTo(415);

        var outage = transcribe(token, TestAudio.webmThatFails(16 * 1024));
        assertThat(outage.getStatusCode().value()).isEqualTo(503);
        assertThat((String) JsonPath.read(outage.getBody(), "$.code")).isEqualTo("TRANSCRIPTION_UNAVAILABLE");
    }

    // --- helpers -----------------------------------------------------------------------------

    private String login(String email) {
        var response = http.post().uri("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"email":"%s","password":"Demo1234!"}""".formatted(email))
                .retrieve().toEntity(String.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        return JsonPath.read(response.getBody(), "$.accessToken");
    }

    private ResponseEntity<String> get(String path, String token) {
        return http.get().uri(path)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .retrieve().toEntity(String.class);
    }

    private ResponseEntity<String> ask(String lessonId, String token, String question, String inputMode) {
        return http.post().uri("/api/lessons/{id}/messages", lessonId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"content":"%s","inputMode":"%s"}""".formatted(question, inputMode))
                .retrieve().toEntity(String.class);
    }

    private ResponseEntity<String> transcribe(String token, byte[] audio) {
        var fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(MediaType.parseMediaType("audio/webm"));
        fileHeaders.setContentDispositionFormData("audio", "grabacion.webm");
        var form = new LinkedMultiValueMap<String, Object>();
        form.add("audio", new HttpEntity<>(new ByteArrayResource(audio) {
            @Override
            public String getFilename() {
                return "grabacion.webm";
            }
        }, fileHeaders));
        return http.post().uri("/api/transcriptions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(form)
                .retrieve().toEntity(String.class);
    }
}

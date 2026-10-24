package com.edtech.tutor.tutor.infra.groq;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withTooManyRequests;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withUnauthorizedRequest;

import com.edtech.tutor.shared.groq.GroqProperties;
import com.edtech.tutor.tutor.domain.LlmUnavailableException;
import com.edtech.tutor.tutor.domain.MessageRole;
import com.edtech.tutor.tutor.domain.TutorPrompt;
import com.edtech.tutor.tutor.domain.TutorPrompt.LessonContext;
import com.edtech.tutor.tutor.domain.TutorPrompt.Turn;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

class GroqLlmAdapterTests {

    static final String URL = "https://groq.test/openai/v1/chat/completions";
    static final GroqProperties PROPS = new GroqProperties("test-key", "https://groq.test/openai/v1",
            "llama-test", "whisper-test", 0.2, 600, Duration.ofSeconds(1), Duration.ofSeconds(2));

    MockRestServiceServer server;
    GroqLlmAdapter adapter;

    @BeforeEach
    void setUp() {
        var builder = RestClient.builder().baseUrl(PROPS.baseUrl());
        server = MockRestServiceServer.bindTo(builder).build();
        adapter = new GroqLlmAdapter(builder.build(), PROPS, JsonMapper.builder().build());
    }

    @Test
    void sendsJsonModeRequestWithSystemHistoryAndQuestionInOrder() {
        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.model").value("llama-test"))
                .andExpect(jsonPath("$.temperature").value(0.2))
                .andExpect(jsonPath("$.max_tokens").value(600))
                .andExpect(jsonPath("$.response_format.type").value("json_object"))
                .andExpect(jsonPath("$.messages.length()").value(4))
                .andExpect(jsonPath("$.messages[0].role").value("system"))
                .andExpect(jsonPath("$.messages[0].content").value("SYSTEM"))
                .andExpect(jsonPath("$.messages[1].role").value("user"))
                .andExpect(jsonPath("$.messages[2].role").value("assistant"))
                .andExpect(jsonPath("$.messages[3].content").value("¿Para qué sirve POST?"))
                .andRespond(withSuccess(completion("{\"answer\":\"POST crea recursos.\",\"grounded\":true}"),
                        MediaType.APPLICATION_JSON));

        var answer = adapter.answer(new TutorPrompt("SYSTEM",
                List.of(new Turn(MessageRole.STUDENT, "¿Qué es GET?"), new Turn(MessageRole.TUTOR, "Lee recursos.")),
                "¿Para qué sirve POST?", new LessonContext("t", "c")));

        assertThat(answer.answer()).isEqualTo("POST crea recursos.");
        assertThat(answer.grounded()).isTrue();
        server.verify();
    }

    @Test
    void parsesNotGroundedAnswers() {
        respond(completion("{\"answer\":\"La lección no trata ese tema.\",\"grounded\":false}"));

        assertThat(adapter.answer(prompt()).grounded()).isFalse();
    }

    @Test
    void transientProviderErrorsAreRetryable() {
        server.expect(requestTo(URL)).andRespond(withTooManyRequests());
        assertRetryable(true);

        server.reset();
        server.expect(requestTo(URL)).andRespond(withServerError());
        assertRetryable(true);

        server.reset();
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertRetryable(true);
    }

    @Test
    void rejectedCredentialsOrRequestsAreNotRetryable() {
        server.expect(requestTo(URL)).andRespond(withUnauthorizedRequest());
        assertRetryable(false);

        server.reset();
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.BAD_REQUEST));
        assertRetryable(false);
    }

    @Test
    void malformedModelOutputIsRetryable() {
        for (var content : List.of("esto no es json", "{\"answer\":\"\",\"grounded\":true}", "{\"answer\":\"Hola\"}")) {
            server.reset();
            respond(completion(content));
            assertRetryable(true);
        }
    }

    @Test
    void emptyChoicesAreRetryable() {
        respond("{\"choices\":[]}");
        assertRetryable(true);
    }

    // --- helpers -----------------------------------------------------------------------------

    private void respond(String body) {
        server.expect(requestTo(URL)).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
    }

    private void assertRetryable(boolean retryable) {
        assertThatThrownBy(() -> adapter.answer(prompt()))
                .isInstanceOf(LlmUnavailableException.class)
                .satisfies(ex -> assertThat(((LlmUnavailableException) ex).isRetryable()).isEqualTo(retryable));
    }

    private static TutorPrompt prompt() {
        return new TutorPrompt("SYSTEM", List.of(), "Pregunta", new LessonContext("t", "c"));
    }

    /** Respuesta de Chat Completions con {@code content} como string JSON escapado. */
    static String completion(String content) {
        var escaped = content.replace("\\", "\\\\").replace("\"", "\\\"");
        return """
                {"id":"x","object":"chat.completion","choices":[{"index":0,
                 "message":{"role":"assistant","content":"%s"},"finish_reason":"stop"}]}""".formatted(escaped);
    }
}

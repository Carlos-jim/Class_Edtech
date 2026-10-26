package com.edtech.tutor.tutor.infra.openai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.shared.ai.AiProvider;
import com.edtech.tutor.shared.ai.OpenAiCompatibleProperties;
import com.edtech.tutor.tutor.domain.LlmUnavailableException;
import com.edtech.tutor.tutor.domain.TutorPrompt;
import com.edtech.tutor.tutor.domain.TutorPrompt.LessonContext;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** Cliente HTTP real (sockets) contra un servidor local: comprueba cabecera de autenticación y timeout de lectura. */
class OpenAiCompatibleHttpClientTests {

    HttpServer server;
    final AtomicReference<String> authorization = new AtomicReference<>();
    volatile long delayMillis;

    @BeforeEach
    void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/openai/v1/chat/completions", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            try {
                Thread.sleep(delayMillis);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            var body = OpenAiCompatibleLlmAdapterTests.completion("{\"answer\":\"Hola\",\"grounded\":true}")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void sendsApiKeyAsBearerToken() {
        var adapter = adapter(Duration.ofSeconds(2));

        assertThat(adapter.answer(prompt()).answer()).isEqualTo("Hola");
        assertThat(authorization.get()).isEqualTo("Bearer secret-key");
    }

    @Test
    void slowProviderTriggersReadTimeoutAsRetryableError() {
        delayMillis = 1500;
        var adapter = adapter(Duration.ofMillis(300));

        var start = System.nanoTime();
        assertThatThrownBy(() -> adapter.answer(prompt()))
                .isInstanceOf(LlmUnavailableException.class)
                .satisfies(ex -> assertThat(((LlmUnavailableException) ex).isRetryable()).isTrue());
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofMillis(1400));
    }

    private OpenAiCompatibleLlmAdapter adapter(Duration readTimeout) {
        var props = new OpenAiCompatibleProperties("secret-key",
                "http://127.0.0.1:" + server.getAddress().getPort() + "/openai/v1",
                "llama-test", "whisper-test", 0.2, 600, Duration.ofSeconds(1), readTimeout);
        return new OpenAiCompatibleLlmAdapter(AiProvider.restClient(props), props, JsonMapper.builder().build(), "Mistral");
    }

    private static TutorPrompt prompt() {
        return new TutorPrompt("SYSTEM", List.of(), "Pregunta", new LessonContext("t", "c"));
    }
}

package com.edtech.tutor.tutor.infra.groq;

import com.edtech.tutor.tutor.domain.LlmPort;
import com.edtech.tutor.tutor.domain.LlmUnavailableException;
import com.edtech.tutor.tutor.domain.MessageRole;
import com.edtech.tutor.tutor.domain.TutorAnswer;
import com.edtech.tutor.tutor.domain.TutorPrompt;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * Adaptador hacia Groq Chat Completions (compatible con OpenAI) en modo JSON.
 * Traduce el {@link TutorPrompt} del dominio al formato del proveedor y clasifica los errores en reintentables
 * (timeout, 429, 5xx, salida mal formada) o permanentes (credenciales, petición inválida).
 */
public class GroqLlmAdapter implements LlmPort {

    private static final Logger log = LoggerFactory.getLogger(GroqLlmAdapter.class);

    // --- Contrato HTTP de Groq / OpenAI ---------------------------------------------------------

    record ChatMessage(String role, String content) {
    }

    record ResponseFormat(String type) {
    }

    record ChatRequest(
            String model,
            List<ChatMessage> messages,
            double temperature,
            @JsonProperty("max_tokens") int maxTokens,
            @JsonProperty("response_format") ResponseFormat responseFormat) {
    }

    record ChatResponse(List<Choice> choices) {

        record Choice(ChatMessage message, @JsonProperty("finish_reason") String finishReason) {
        }
    }

    /** Lo que el prompt exige devolver al modelo. */
    record StructuredAnswer(String answer, Boolean grounded) {
    }

    // --------------------------------------------------------------------------------------------

    private final RestClient http;
    private final GroqProperties properties;
    private final ObjectMapper json;

    public GroqLlmAdapter(RestClient http, GroqProperties properties, ObjectMapper json) {
        this.http = http;
        this.properties = properties;
        this.json = json;
    }

    /** Cliente HTTP con timeouts explícitos y la clave en la cabecera. */
    public static RestClient restClient(GroqProperties properties) {
        var httpClient = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
        var requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        return RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey())
                .build();
    }

    @Override
    public TutorAnswer answer(TutorPrompt prompt) {
        var request = new ChatRequest(properties.model(), toMessages(prompt), properties.temperature(),
                properties.maxTokens(), new ResponseFormat("json_object"));

        ChatResponse response;
        try {
            response = http.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(ChatResponse.class);
        } catch (HttpClientErrorException.TooManyRequests ex) {
            throw LlmUnavailableException.retryable("Groq: límite de peticiones alcanzado (429)", ex);
        } catch (HttpServerErrorException ex) {
            throw LlmUnavailableException.retryable("Groq: error del servidor (" + ex.getStatusCode().value() + ")", ex);
        } catch (HttpClientErrorException ex) {
            if (ex.getStatusCode().value() == 401) {
                log.error("Groq rechazó la API key (401). Revisa GROQ_API_KEY.");
            }
            throw LlmUnavailableException.permanent("Groq: petición rechazada (" + ex.getStatusCode().value() + ")", ex);
        } catch (ResourceAccessException ex) {
            throw LlmUnavailableException.retryable("Groq: sin respuesta a tiempo o error de red", ex);
        }

        return parse(response);
    }

    private static List<ChatMessage> toMessages(TutorPrompt prompt) {
        var messages = new ArrayList<ChatMessage>();
        messages.add(new ChatMessage("system", prompt.systemInstructions()));
        for (var turn : prompt.history()) {
            messages.add(new ChatMessage(turn.role() == MessageRole.STUDENT ? "user" : "assistant", turn.content()));
        }
        messages.add(new ChatMessage("user", prompt.question()));
        return messages;
    }

    private TutorAnswer parse(ChatResponse response) {
        if (response == null || response.choices() == null || response.choices().isEmpty()
                || response.choices().getFirst().message() == null) {
            throw LlmUnavailableException.retryable("Groq: respuesta vacía", null);
        }
        var content = response.choices().getFirst().message().content();
        try {
            var structured = json.readValue(content, StructuredAnswer.class);
            if (structured.answer() == null || structured.answer().isBlank() || structured.grounded() == null) {
                throw LlmUnavailableException.retryable("Groq: JSON sin 'answer' o 'grounded'", null);
            }
            return new TutorAnswer(structured.answer(), structured.grounded());
        } catch (JacksonException | IllegalArgumentException ex) {
            throw LlmUnavailableException.retryable("Groq: la salida no es el JSON esperado", ex);
        }
    }
}

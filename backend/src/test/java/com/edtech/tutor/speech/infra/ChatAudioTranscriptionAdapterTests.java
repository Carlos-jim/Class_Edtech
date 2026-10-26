package com.edtech.tutor.speech.infra;

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

import com.edtech.tutor.shared.ai.OpenAiCompatibleProperties;
import com.edtech.tutor.speech.TestAudio;
import com.edtech.tutor.speech.domain.AudioClip;
import com.edtech.tutor.speech.domain.AudioFormat;
import com.edtech.tutor.speech.domain.TranscriptionUnavailableException;
import java.time.Duration;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ChatAudioTranscriptionAdapterTests {

    static final String URL = "https://ai.test/v1beta/openai/chat/completions";
    static final OpenAiCompatibleProperties PROPS = new OpenAiCompatibleProperties("k", "https://ai.test/v1beta/openai",
            "chat-test", "gemini-stt-test", 0.2, 600, Duration.ofSeconds(1), Duration.ofSeconds(2));
    static final AudioClip WAV = new AudioClip(TestAudio.wav(2048), AudioFormat.WAV);

    MockRestServiceServer server;
    ChatAudioTranscriptionAdapter adapter;

    @BeforeEach
    void setUp() {
        var builder = RestClient.builder().baseUrl(PROPS.baseUrl());
        server = MockRestServiceServer.bindTo(builder).build();
        adapter = new ChatAudioTranscriptionAdapter(builder.build(), PROPS, "Gemini");
    }

    @Test
    void sendsTheAudioAsBase64InputAudioWithTranscriptionInstructions() {
        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.model").value("gemini-stt-test"))
                .andExpect(jsonPath("$.temperature").value(0.0))
                .andExpect(jsonPath("$.messages[0].role").value("system"))
                .andExpect(jsonPath("$.messages[0].content").value(ChatAudioTranscriptionAdapter.INSTRUCTIONS))
                .andExpect(jsonPath("$.messages[1].role").value("user"))
                .andExpect(jsonPath("$.messages[1].content[0].type").value("input_audio"))
                .andExpect(jsonPath("$.messages[1].content[0].input_audio.format").value("wav"))
                .andExpect(jsonPath("$.messages[1].content[0].input_audio.data")
                        .value(Base64.getEncoder().encodeToString(WAV.data())))
                .andRespond(withSuccess(completion("¿Para qué sirve el método POST?"), MediaType.APPLICATION_JSON));

        assertThat(adapter.transcribe(WAV)).isEqualTo("¿Para qué sirve el método POST?");
        server.verify();
    }

    @Test
    void removesWrappingQuotesAndHandlesEmptyResults() {
        server.expect(requestTo(URL)).andRespond(withSuccess(completion("\\\"Hola\\\""), MediaType.APPLICATION_JSON));
        assertThat(adapter.transcribe(WAV)).isEqualTo("Hola");

        server.reset();
        server.expect(requestTo(URL)).andRespond(withSuccess("{\"choices\":[]}", MediaType.APPLICATION_JSON));
        assertThat(adapter.transcribe(WAV)).isEmpty();
    }

    @Test
    void rejectsFormatsTheChatApiDoesNotAcceptWithoutCallingTheProvider() {
        var webm = new AudioClip(TestAudio.webm(2048), AudioFormat.WEBM);

        assertThatThrownBy(() -> adapter.transcribe(webm))
                .isInstanceOf(TranscriptionUnavailableException.class)
                .hasMessageContaining("WAV o MP3");
        server.verify(); // ninguna petición
    }

    @Test
    void classifiesProviderErrors() {
        server.expect(requestTo(URL)).andRespond(withServerError()); // 503 "high demand"
        assertRetryable(true);

        server.reset();
        server.expect(requestTo(URL)).andRespond(withTooManyRequests());
        assertRetryable(true);

        server.reset();
        server.expect(requestTo(URL)).andRespond(withUnauthorizedRequest());
        assertRetryable(false);

        server.reset();
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.BAD_REQUEST));
        assertRetryable(false);
    }

    @Test
    void stripWrappingQuotesKeepsInnerQuotes() {
        assertThat(ChatAudioTranscriptionAdapter.stripWrappingQuotes("«¿Qué es REST?»")).isEqualTo("¿Qué es REST?");
        assertThat(ChatAudioTranscriptionAdapter.stripWrappingQuotes("El método \"POST\""))
                .isEqualTo("El método \"POST\"");
    }

    private void assertRetryable(boolean retryable) {
        assertThatThrownBy(() -> adapter.transcribe(WAV))
                .isInstanceOf(TranscriptionUnavailableException.class)
                .satisfies(ex -> assertThat(((TranscriptionUnavailableException) ex).isRetryable()).isEqualTo(retryable));
    }

    private static String completion(String content) {
        return """
                {"choices":[{"index":0,"message":{"role":"assistant","content":"%s"},"finish_reason":"stop"}]}"""
                .formatted(content);
    }
}

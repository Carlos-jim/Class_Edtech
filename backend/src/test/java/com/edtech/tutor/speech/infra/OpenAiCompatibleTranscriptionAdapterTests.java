package com.edtech.tutor.speech.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withTooManyRequests;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withUnauthorizedRequest;

import com.edtech.tutor.shared.ai.OpenAiCompatibleProperties;
import com.edtech.tutor.speech.TestAudio;
import com.edtech.tutor.speech.domain.AudioClip;
import com.edtech.tutor.speech.domain.AudioFormat;
import com.edtech.tutor.speech.domain.TranscriptionUnavailableException;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class OpenAiCompatibleTranscriptionAdapterTests {

    static final String URL = "https://ai.test/v1/audio/transcriptions";
    static final OpenAiCompatibleProperties PROPS = new OpenAiCompatibleProperties("k", "https://ai.test/v1", "chat-test",
            "whisper-large-v3-turbo", 0.2, 600, Duration.ofSeconds(1), Duration.ofSeconds(2));
    static final AudioClip CLIP = new AudioClip(TestAudio.webm(2048), AudioFormat.WEBM);

    MockRestServiceServer server;
    OpenAiCompatibleTranscriptionAdapter adapter;

    @BeforeEach
    void setUp() {
        var builder = RestClient.builder().baseUrl(PROPS.baseUrl());
        server = MockRestServiceServer.bindTo(builder).build();
        adapter = new OpenAiCompatibleTranscriptionAdapter(builder.build(), PROPS, "Mistral");
    }

    @Test
    void sendsOnlyCommonMultipartFieldsWithGeneratedFilename() {
        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header(HttpHeaders.CONTENT_TYPE, containsString("multipart/form-data")))
                .andExpect(content().string(allOf(
                        containsString("name=\"model\""), containsString("whisper-large-v3-turbo"),
                        containsString("name=\"language\""), containsString("es"),
                        containsString("filename=\"pregunta.webm\""), containsString("Content-Type: audio/webm"),
                        // Solo campos comunes a todos los proveedores (Mistral no documenta response_format).
                        not(containsString("response_format")))))
                .andRespond(withSuccess("{\"text\":\" ¿Para qué sirve POST?\"}", MediaType.APPLICATION_JSON));

        assertThat(adapter.transcribe(CLIP)).isEqualTo(" ¿Para qué sirve POST?");
        server.verify();
    }

    @Test
    void missingTextIsTreatedAsEmptyTranscript() {
        server.expect(requestTo(URL)).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertThat(adapter.transcribe(CLIP)).isEmpty();
    }

    @Test
    void classifiesProviderErrors() {
        server.expect(requestTo(URL)).andRespond(withTooManyRequests());
        assertRetryable(true);

        server.reset();
        server.expect(requestTo(URL)).andRespond(withServerError());
        assertRetryable(true);

        server.reset();
        server.expect(requestTo(URL)).andRespond(withUnauthorizedRequest());
        assertRetryable(false);
    }

    private void assertRetryable(boolean retryable) {
        assertThatThrownBy(() -> adapter.transcribe(CLIP))
                .isInstanceOf(TranscriptionUnavailableException.class)
                .satisfies(ex -> assertThat(((TranscriptionUnavailableException) ex).isRetryable()).isEqualTo(retryable));
    }
}

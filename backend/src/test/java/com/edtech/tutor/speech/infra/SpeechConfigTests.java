package com.edtech.tutor.speech.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.shared.ai.AiProvider;
import com.edtech.tutor.shared.ai.AiProviders;
import com.edtech.tutor.shared.ai.OpenAiCompatibleProperties;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class SpeechConfigTests {

    @Test
    void mistralIsTheDefaultProvider() {
        assertThat(SpeechConfig.create(null, providers("mistral-key", "")))
                .isInstanceOf(OpenAiCompatibleTranscriptionAdapter.class);
        assertThat(SpeechConfig.create("  ", providers("mistral-key", "")))
                .isInstanceOf(OpenAiCompatibleTranscriptionAdapter.class);
    }

    @Test
    void groqCanBeSelectedByConfiguration() {
        assertThat(SpeechConfig.create("groq", providers("", "gsk_test")))
                .isInstanceOf(OpenAiCompatibleTranscriptionAdapter.class);
    }

    @Test
    void mockIsOnlyUsedWhenExplicitlySelected() {
        assertThat(SpeechConfig.create("mock", providers("", ""))).isInstanceOf(MockTranscriptionAdapter.class);
    }

    @Test
    void selectedProviderWithoutApiKeyFailsFast() {
        assertThatThrownBy(() -> SpeechConfig.create("mistral", providers("", "gsk_test")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("STT_PROVIDER=mistral")
                .hasMessageContaining("MISTRAL_API_KEY");
    }

    @Test
    void unknownProviderIsRejected() {
        assertThatThrownBy(() -> SpeechConfig.create("browser", providers("x", "y")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("mock, mistral, groq");
    }

    private static AiProviders providers(String mistralKey, String groqKey) {
        return new AiProviders(
                new AiProvider("mistral", "Mistral", "MISTRAL_API_KEY", "https://console.mistral.ai/api-keys",
                        settings(mistralKey)),
                new AiProvider("groq", "Groq", "GROQ_API_KEY", "https://console.groq.com/keys", settings(groqKey)));
    }

    private static OpenAiCompatibleProperties settings(String apiKey) {
        return new OpenAiCompatibleProperties(apiKey, "https://ai.test/v1", "chat-model", "transcription-model",
                0.2, 600, Duration.ofSeconds(3), Duration.ofSeconds(15));
    }
}

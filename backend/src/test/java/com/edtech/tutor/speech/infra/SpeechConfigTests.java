package com.edtech.tutor.speech.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.shared.ai.AiProvider;
import com.edtech.tutor.shared.ai.AiProvider.TranscriptionApi;
import com.edtech.tutor.shared.ai.AiProviders;
import com.edtech.tutor.shared.ai.OpenAiCompatibleProperties;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class SpeechConfigTests {

    @Test
    void geminiIsTheDefaultAndTranscribesThroughTheChat() {
        assertThat(SpeechConfig.create(null, providers("gemini-key", "", "")))
                .isInstanceOf(ChatAudioTranscriptionAdapter.class);
        assertThat(SpeechConfig.create("  ", providers("gemini-key", "", "")))
                .isInstanceOf(ChatAudioTranscriptionAdapter.class);
    }

    @Test
    void groqAndMistralUseTheAudioTranscriptionsEndpoint() {
        assertThat(SpeechConfig.create("groq", providers("", "gsk_test", "")))
                .isInstanceOf(OpenAiCompatibleTranscriptionAdapter.class);
        assertThat(SpeechConfig.create("mistral", providers("", "", "m-key")))
                .isInstanceOf(OpenAiCompatibleTranscriptionAdapter.class);
    }

    @Test
    void mockIsOnlyUsedWhenExplicitlySelected() {
        assertThat(SpeechConfig.create("mock", providers("", "", ""))).isInstanceOf(MockTranscriptionAdapter.class);
    }

    @Test
    void selectedProviderWithoutApiKeyFailsFast() {
        assertThatThrownBy(() -> SpeechConfig.create("gemini", providers("", "gsk_test", "m")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("STT_PROVIDER=gemini")
                .hasMessageContaining("GEMINI_API_KEY");
    }

    @Test
    void unknownProviderIsRejected() {
        assertThatThrownBy(() -> SpeechConfig.create("browser", providers("x", "y", "z")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("mock, gemini, groq, mistral");
    }

    private static AiProviders providers(String geminiKey, String groqKey, String mistralKey) {
        return new AiProviders(
                new AiProvider("gemini", "Gemini", "GEMINI_API_KEY", "https://aistudio.google.com/apikey",
                        TranscriptionApi.CHAT_INPUT_AUDIO, settings(geminiKey)),
                new AiProvider("groq", "Groq", "GROQ_API_KEY", "https://console.groq.com/keys",
                        TranscriptionApi.AUDIO_TRANSCRIPTIONS, settings(groqKey)),
                new AiProvider("mistral", "Mistral", "MISTRAL_API_KEY", "https://console.mistral.ai/api-keys",
                        TranscriptionApi.AUDIO_TRANSCRIPTIONS, settings(mistralKey)));
    }

    private static OpenAiCompatibleProperties settings(String apiKey) {
        return new OpenAiCompatibleProperties(apiKey, "https://ai.test/v1", "chat-model", "transcription-model",
                0.2, 600, Duration.ofSeconds(3), Duration.ofSeconds(15));
    }
}

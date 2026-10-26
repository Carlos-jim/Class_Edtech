package com.edtech.tutor.tutor.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.shared.ai.AiProvider;
import com.edtech.tutor.shared.ai.AiProvider.TranscriptionApi;
import com.edtech.tutor.shared.ai.AiProviders;
import com.edtech.tutor.shared.ai.OpenAiCompatibleProperties;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class LlmConfigTests {

    static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void geminiIsTheDefaultProvider() {
        var providers = providers("gemini-key", "", "");

        assertThat(LlmConfig.create(null, providers, JSON)).isInstanceOf(ResilientLlmPort.class);
        assertThat(LlmConfig.create(" ", providers, JSON)).isInstanceOf(ResilientLlmPort.class);
    }

    @Test
    void otherProvidersCanBeSelectedByConfiguration() {
        assertThat(LlmConfig.create("mistral", providers("", "", "m-key"), JSON)).isInstanceOf(ResilientLlmPort.class);
        assertThat(LlmConfig.create("GROQ", providers("", "gsk_test", ""), JSON)).isInstanceOf(ResilientLlmPort.class);
    }

    @Test
    void mockIsOnlyUsedWhenExplicitlySelected() {
        assertThat(LlmConfig.create(" MOCK ", providers("", "", ""), JSON)).isInstanceOf(MockLlmAdapter.class);
    }

    @Test
    void selectedProviderWithoutApiKeyFailsFastWithActionableMessage() {
        assertThatThrownBy(() -> LlmConfig.create(null, providers("", "gsk_test", "m"), JSON))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("LLM_PROVIDER=gemini")
                .hasMessageContaining("GEMINI_API_KEY")
                .hasMessageContaining("aistudio.google.com/apikey");

        assertThatThrownBy(() -> LlmConfig.create("mistral", providers("g", "gsk_test", ""), JSON))
                .hasMessageContaining("MISTRAL_API_KEY");

        assertThatThrownBy(() -> LlmConfig.create("groq", providers("g", " ", "m"), JSON))
                .hasMessageContaining("GROQ_API_KEY")
                .hasMessageContaining("console.groq.com/keys");
    }

    @Test
    void unknownProviderIsRejectedListingTheValidOnes() {
        assertThatThrownBy(() -> LlmConfig.create("openai", providers("x", "y", "z"), JSON))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("mock, gemini, groq, mistral");
    }

    @Test
    void propertiesNeverPrintTheApiKey() {
        assertThat(settings("https://api.mistral.ai/v1", "super_secret").toString())
                .doesNotContain("super_secret")
                .contains("****");
    }

    static AiProviders providers(String geminiKey, String groqKey, String mistralKey) {
        return new AiProviders(
                new AiProvider("gemini", "Gemini", "GEMINI_API_KEY", "https://aistudio.google.com/apikey",
                        TranscriptionApi.CHAT_INPUT_AUDIO,
                        settings("https://generativelanguage.googleapis.com/v1beta/openai", geminiKey)),
                new AiProvider("groq", "Groq", "GROQ_API_KEY", "https://console.groq.com/keys",
                        TranscriptionApi.AUDIO_TRANSCRIPTIONS, settings("https://api.groq.com/openai/v1", groqKey)),
                new AiProvider("mistral", "Mistral", "MISTRAL_API_KEY", "https://console.mistral.ai/api-keys",
                        TranscriptionApi.AUDIO_TRANSCRIPTIONS, settings("https://api.mistral.ai/v1", mistralKey)));
    }

    static OpenAiCompatibleProperties settings(String baseUrl, String apiKey) {
        return new OpenAiCompatibleProperties(apiKey, baseUrl, "chat-model", "transcription-model",
                0.2, 600, Duration.ofSeconds(3), Duration.ofSeconds(15));
    }
}

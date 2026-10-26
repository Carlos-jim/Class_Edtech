package com.edtech.tutor.tutor.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.shared.ai.AiProvider;
import com.edtech.tutor.shared.ai.AiProviders;
import com.edtech.tutor.shared.ai.OpenAiCompatibleProperties;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class LlmConfigTests {

    static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void mistralIsTheDefaultProvider() {
        var providers = providers("mistral-key", "");

        assertThat(LlmConfig.create(null, providers, JSON)).isInstanceOf(ResilientLlmPort.class);
        assertThat(LlmConfig.create(" ", providers, JSON)).isInstanceOf(ResilientLlmPort.class);
    }

    @Test
    void groqCanBeSelectedByConfiguration() {
        assertThat(LlmConfig.create("GROQ", providers("", "gsk_test"), JSON)).isInstanceOf(ResilientLlmPort.class);
    }

    @Test
    void mockIsOnlyUsedWhenExplicitlySelected() {
        assertThat(LlmConfig.create(" MOCK ", providers("", ""), JSON)).isInstanceOf(MockLlmAdapter.class);
    }

    @Test
    void selectedProviderWithoutApiKeyFailsFastWithActionableMessage() {
        assertThatThrownBy(() -> LlmConfig.create("mistral", providers("", "gsk_test"), JSON))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("LLM_PROVIDER=mistral")
                .hasMessageContaining("MISTRAL_API_KEY")
                .hasMessageContaining("console.mistral.ai");

        assertThatThrownBy(() -> LlmConfig.create("groq", providers("mistral-key", " "), JSON))
                .hasMessageContaining("GROQ_API_KEY")
                .hasMessageContaining("console.groq.com/keys");
    }

    @Test
    void unknownProviderIsRejectedListingTheValidOnes() {
        assertThatThrownBy(() -> LlmConfig.create("openai", providers("x", "y"), JSON))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("mock, mistral, groq");
    }

    @Test
    void propertiesNeverPrintTheApiKey() {
        assertThat(settings("https://api.mistral.ai/v1", "super_secret").toString())
                .doesNotContain("super_secret")
                .contains("****");
    }

    static AiProviders providers(String mistralKey, String groqKey) {
        return new AiProviders(
                new AiProvider("mistral", "Mistral", "MISTRAL_API_KEY", "https://console.mistral.ai/api-keys",
                        settings("https://api.mistral.ai/v1", mistralKey)),
                new AiProvider("groq", "Groq", "GROQ_API_KEY", "https://console.groq.com/keys",
                        settings("https://api.groq.com/openai/v1", groqKey)));
    }

    static OpenAiCompatibleProperties settings(String baseUrl, String apiKey) {
        return new OpenAiCompatibleProperties(apiKey, baseUrl, "chat-model", "transcription-model",
                0.2, 600, Duration.ofSeconds(3), Duration.ofSeconds(15));
    }
}

package com.edtech.tutor.tutor.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.shared.groq.GroqProperties;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class LlmConfigTests {

    static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void mockIsTheDefaultProvider() {
        assertThat(LlmConfig.create(null, groq(""), JSON)).isInstanceOf(MockLlmAdapter.class);
        assertThat(LlmConfig.create(" MOCK ", groq(""), JSON)).isInstanceOf(MockLlmAdapter.class);
    }

    @Test
    void groqProviderIsWrappedWithResilience() {
        assertThat(LlmConfig.create("groq", groq("gsk_test"), JSON)).isInstanceOf(ResilientLlmPort.class);
    }

    @Test
    void groqWithoutApiKeyFailsFastWithActionableMessage() {
        assertThatThrownBy(() -> LlmConfig.create("groq", groq(" "), JSON))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("GROQ_API_KEY")
                .hasMessageContaining("LLM_PROVIDER=groq").hasMessageContaining("'mock'");
    }

    @Test
    void unknownProviderIsRejected() {
        assertThatThrownBy(() -> LlmConfig.create("openai", groq("x"), JSON))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("mock, groq");
    }

    @Test
    void propertiesNeverPrintTheApiKey() {
        assertThat(groq("gsk_super_secret").toString()).doesNotContain("gsk_super_secret").contains("****");
    }

    private static GroqProperties groq(String apiKey) {
        return new GroqProperties(apiKey, "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", "whisper-large-v3-turbo",
                0.2, 600, Duration.ofSeconds(3), Duration.ofSeconds(15));
    }
}

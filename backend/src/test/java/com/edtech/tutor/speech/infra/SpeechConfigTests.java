package com.edtech.tutor.speech.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.shared.groq.GroqProperties;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class SpeechConfigTests {

    @Test
    void groqIsTheDefaultProvider() {
        assertThat(SpeechConfig.create(null, groq("gsk_test"))).isInstanceOf(GroqWhisperAdapter.class);
        assertThat(SpeechConfig.create("  ", groq("gsk_test"))).isInstanceOf(GroqWhisperAdapter.class);
    }

    @Test
    void mockIsOnlyUsedWhenExplicitlySelected() {
        assertThat(SpeechConfig.create("mock", groq(""))).isInstanceOf(MockTranscriptionAdapter.class);
    }

    @Test
    void groqProviderUsesWhisperAdapter() {
        assertThat(SpeechConfig.create("GROQ", groq("gsk_test"))).isInstanceOf(GroqWhisperAdapter.class);
    }

    @Test
    void groqWithoutApiKeyFailsFast() {
        assertThatThrownBy(() -> SpeechConfig.create("groq", groq("")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("STT_PROVIDER=groq")
                .hasMessageContaining("GROQ_API_KEY");
    }

    @Test
    void unknownProviderIsRejected() {
        assertThatThrownBy(() -> SpeechConfig.create("browser", groq("x")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("mock, groq");
    }

    private static GroqProperties groq(String apiKey) {
        return new GroqProperties(apiKey, "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile",
                "whisper-large-v3-turbo", 0.2, 600, Duration.ofSeconds(3), Duration.ofSeconds(15));
    }
}

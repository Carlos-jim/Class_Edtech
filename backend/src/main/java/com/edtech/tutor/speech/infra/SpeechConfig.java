package com.edtech.tutor.speech.infra;

import com.edtech.tutor.shared.groq.GroqClient;
import com.edtech.tutor.shared.groq.GroqProperties;
import com.edtech.tutor.speech.application.SpeechProperties;
import com.edtech.tutor.speech.domain.TranscriptionPort;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Elige la implementación de {@link TranscriptionPort} según {@code speech.provider} (Strategy + Factory). */
@Configuration
@EnableConfigurationProperties(SpeechProperties.class)
class SpeechConfig {

    private static final Logger log = LoggerFactory.getLogger(SpeechConfig.class);

    @Bean
    TranscriptionPort transcriptionPort(SpeechProperties speech, GroqProperties groq) {
        return create(speech.provider(), groq);
    }

    static TranscriptionPort create(String provider, GroqProperties groq) {
        var selected = provider == null || provider.isBlank() ? "mock" : provider.strip().toLowerCase(Locale.ROOT);
        return switch (selected) {
            case "mock" -> {
                log.info("Voz a texto: proveedor MOCK (transcripción simulada)");
                yield new MockTranscriptionAdapter();
            }
            case "groq" -> {
                if (!groq.hasApiKey()) {
                    throw new IllegalStateException("STT_PROVIDER=groq " + GroqClient.MISSING_KEY_MESSAGE);
                }
                log.info("Voz a texto: proveedor GROQ, modelo {}", groq.transcriptionModel());
                yield new GroqWhisperAdapter(GroqClient.restClient(groq), groq);
            }
            default -> throw new IllegalStateException(
                    "speech.provider no soportado: '" + provider + "'. Valores válidos: mock, groq");
        };
    }
}

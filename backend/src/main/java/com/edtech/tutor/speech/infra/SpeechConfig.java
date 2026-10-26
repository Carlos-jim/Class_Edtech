package com.edtech.tutor.speech.infra;

import com.edtech.tutor.shared.ai.AiProviders;
import com.edtech.tutor.speech.application.SpeechProperties;
import com.edtech.tutor.speech.domain.TranscriptionPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Elige la implementación de {@link TranscriptionPort} según {@code speech.provider} (Strategy + Factory).
 * Groq (Whisper) y Mistral (Voxtral) usan {@code /audio/transcriptions}; Gemini transcribe enviando el audio por el chat.
 */
@Configuration
@EnableConfigurationProperties(SpeechProperties.class)
class SpeechConfig {

    private static final Logger log = LoggerFactory.getLogger(SpeechConfig.class);

    @Bean
    TranscriptionPort transcriptionPort(SpeechProperties speech, AiProviders providers) {
        return create(speech.provider(), providers);
    }

    static TranscriptionPort create(String provider, AiProviders providers) {
        var selected = AiProviders.normalize(provider);
        if (AiProviders.MOCK.equals(selected)) {
            log.warn("Voz a texto: proveedor MOCK (transcripción simulada, solo para tests automáticos)");
            return new MockTranscriptionAdapter();
        }
        var ai = providers.require(selected, "STT_PROVIDER");
        log.info("Voz a texto: proveedor {}, modelo {}", ai.label(), ai.settings().transcriptionModel());
        return switch (ai.transcription()) {
            case AUDIO_TRANSCRIPTIONS -> new OpenAiCompatibleTranscriptionAdapter(ai.restClient(), ai.settings(), ai.label());
            case CHAT_INPUT_AUDIO -> new ChatAudioTranscriptionAdapter(ai.restClient(), ai.settings(), ai.label());
        };
    }
}

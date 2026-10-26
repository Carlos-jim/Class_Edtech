package com.edtech.tutor.speech.infra;

import com.edtech.tutor.shared.ai.AiProvider;
import com.edtech.tutor.shared.ai.AiProvider.TranscriptionApi;
import com.edtech.tutor.shared.ai.AiProviders;
import com.edtech.tutor.shared.ai.Hedging;
import com.edtech.tutor.shared.ai.OpenAiCompatibleProperties;
import com.edtech.tutor.speech.application.SpeechProperties;
import com.edtech.tutor.speech.domain.TranscriptionPort;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

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
        if (ai.transcription() == TranscriptionApi.NONE) {
            throw new IllegalStateException(("%s no ofrece voz a texto: indica otro proveedor para la voz, "
                    + "p. ej. STT_PROVIDER=gemini").formatted(ai.label()));
        }
        var models = ai.settings().transcriptionModels();
        log.info("Voz a texto: proveedor {}, modelos {}", ai.label(), models);
        var http = ai.restClient();
        List<TranscriptionPort> adapters = models.stream()
                .map(model -> adapter(ai, ai.settings().withTranscriptionModel(model), http, ai.label() + " " + model))
                .toList();
        return adapters.size() == 1
                ? adapters.getFirst()
                : new HedgedTranscriptionPort(adapters, ai.label(), Hedging.DEFAULT_STAGGER, Hedging.DEFAULT_DEADLINE);
    }

    private static TranscriptionPort adapter(AiProvider ai, OpenAiCompatibleProperties settings, RestClient http, String label) {
        return switch (ai.transcription()) {
            // Whisper (Groq) admite "prompt" para sesgar el vocabulario; Mistral no lo documenta.
            case AUDIO_TRANSCRIPTIONS -> new OpenAiCompatibleTranscriptionAdapter(http, settings, label, "groq".equals(ai.id()));
            case CHAT_INPUT_AUDIO -> new ChatAudioTranscriptionAdapter(http, settings, label);
            case NONE -> throw new IllegalStateException(ai.label() + " no ofrece voz a texto");
        };
    }
}

package com.edtech.tutor.speech.infra;

import com.edtech.tutor.speech.application.TtsProperties;
import com.edtech.tutor.speech.domain.SpeechSynthesisPort;
import com.edtech.tutor.speech.domain.SpeechSynthesisUnavailableException;
import java.nio.file.Path;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Elige el motor de texto a voz (Strategy + Factory). Si Piper no está instalado (desarrollo fuera de Docker) no se
 * impide arrancar: el endpoint responde 503 y el navegador recurre a su propia síntesis de voz.
 */
@Configuration
@EnableConfigurationProperties(TtsProperties.class)
class TtsConfig {

    private static final Logger log = LoggerFactory.getLogger(TtsConfig.class);

    @Bean
    SpeechSynthesisPort speechSynthesisPort(TtsProperties properties) {
        return create(properties);
    }

    static SpeechSynthesisPort create(TtsProperties properties) {
        var engine = properties.engine() == null ? "none" : properties.engine().strip().toLowerCase(Locale.ROOT);
        switch (engine) {
            case "mock" -> {
                log.warn("Texto a voz: motor MOCK (silencio, solo para tests)");
                return new MockSpeechSynthesisAdapter();
            }
            case "piper" -> {
                var piper = new PiperSynthesisAdapter(Path.of(properties.piperBinary()), Path.of(properties.piperModel()),
                        properties.timeout());
                if (piper.isInstalled()) {
                    log.info("Texto a voz: Piper ({})", properties.piperModel());
                    return piper;
                }
                log.warn("Texto a voz: Piper no está instalado en {}; se usará la voz del navegador", properties.piperBinary());
                return disabled();
            }
            case "none" -> {
                log.info("Texto a voz en el servidor desactivado: se usará la voz del navegador");
                return disabled();
            }
            default -> throw new IllegalStateException(
                    "speech.tts.engine no soportado: '" + properties.engine() + "'. Valores válidos: piper, none, mock");
        }
    }

    private static SpeechSynthesisPort disabled() {
        return text -> {
            throw new SpeechSynthesisUnavailableException("Texto a voz en el servidor no disponible");
        };
    }
}

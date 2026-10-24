package com.edtech.tutor.shared.groq;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuración de Groq (API compatible con OpenAI), compartida por el chat del tutor y la transcripción (Whisper).
 * La clave solo vive en el backend: nunca llega al navegador.
 */
@ConfigurationProperties("groq")
public record GroqProperties(
        String apiKey,
        String baseUrl,
        String chatModel,
        String transcriptionModel,
        double temperature,
        int maxTokens,
        Duration connectTimeout,
        Duration readTimeout) {

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }

    /** Nunca imprimir la clave en logs. */
    @Override
    public String toString() {
        return ("GroqProperties[apiKey=%s, baseUrl=%s, chatModel=%s, transcriptionModel=%s, temperature=%s, "
                + "maxTokens=%d, connectTimeout=%s, readTimeout=%s]")
                .formatted(hasApiKey() ? "****" : "<vacía>", baseUrl, chatModel, transcriptionModel, temperature,
                        maxTokens, connectTimeout, readTimeout);
    }
}

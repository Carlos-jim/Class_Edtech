package com.edtech.tutor.tutor.infra.groq;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuración de Groq (API compatible con OpenAI). La clave solo vive en el backend: nunca llega al navegador.
 */
@ConfigurationProperties("tutor.llm.groq")
public record GroqProperties(
        String apiKey,
        String baseUrl,
        String model,
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
        return "GroqProperties[apiKey=%s, baseUrl=%s, model=%s, temperature=%s, maxTokens=%d, connectTimeout=%s, readTimeout=%s]"
                .formatted(hasApiKey() ? "****" : "<vacía>", baseUrl, model, temperature, maxTokens, connectTimeout, readTimeout);
    }
}

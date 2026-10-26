package com.edtech.tutor.shared.ai;

import java.time.Duration;

/**
 * Conexión a un proveedor con API compatible con OpenAI (chat completions + audio transcriptions):
 * Mistral, Groq... La clave solo vive en el backend: nunca llega al navegador.
 */
public record OpenAiCompatibleProperties(
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
        return ("OpenAiCompatibleProperties[apiKey=%s, baseUrl=%s, chatModel=%s, transcriptionModel=%s, "
                + "temperature=%s, maxTokens=%d, connectTimeout=%s, readTimeout=%s]")
                .formatted(hasApiKey() ? "****" : "<vacía>", baseUrl, chatModel, transcriptionModel, temperature,
                        maxTokens, connectTimeout, readTimeout);
    }
}

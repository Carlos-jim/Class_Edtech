package com.edtech.tutor.shared.ai;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

/**
 * Conexión a un proveedor con API compatible con OpenAI (chat completions + audio transcriptions):
 * Gemini, Cerebras, Groq, Mistral... La clave solo vive en el backend: nunca llega al navegador.
 *
 * <p>{@code chatModel} y {@code transcriptionModel} admiten una lista separada por comas: con varios modelos se piden
 * "en relevo" (ver {@link Hedging}) y gana el primero que responde.
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

    /** Modelos de chat en orden de preferencia. */
    public List<String> chatModels() {
        return split(chatModel);
    }

    /** Modelos de transcripción en orden de preferencia (vacío si el proveedor no transcribe). */
    public List<String> transcriptionModels() {
        return split(transcriptionModel);
    }

    public OpenAiCompatibleProperties withChatModel(String model) {
        return new OpenAiCompatibleProperties(apiKey, baseUrl, model, transcriptionModel, temperature, maxTokens,
                connectTimeout, readTimeout);
    }

    public OpenAiCompatibleProperties withTranscriptionModel(String model) {
        return new OpenAiCompatibleProperties(apiKey, baseUrl, chatModel, model, temperature, maxTokens,
                connectTimeout, readTimeout);
    }

    private static List<String> split(String models) {
        return models == null ? List.of() : Arrays.stream(models.split(",")).map(String::strip).filter(m -> !m.isEmpty()).toList();
    }

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

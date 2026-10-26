package com.edtech.tutor.shared.ai;

import java.net.http.HttpClient;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Un proveedor de IA concreto.
 *
 * @param id            valor de {@code LLM_PROVIDER} / {@code STT_PROVIDER} (p. ej. {@code gemini})
 * @param label         nombre para logs y mensajes
 * @param keyEnvVar     variable de entorno de su clave
 * @param keyUrl        dónde conseguir una clave gratuita
 * @param transcription cómo transcribe la voz su API
 * @param settings      conexión y modelos
 */
public record AiProvider(String id, String label, String keyEnvVar, String keyUrl, TranscriptionApi transcription,
                         OpenAiCompatibleProperties settings) {

    /** Vía de transcripción que ofrece la API compatible con OpenAI del proveedor. */
    public enum TranscriptionApi {
        /** {@code POST /audio/transcriptions} multipart (Groq Whisper, Mistral Voxtral). */
        AUDIO_TRANSCRIPTIONS,
        /** Audio en un mensaje de chat ({@code input_audio}, WAV/MP3) con instrucción de transcribir (Gemini). */
        CHAT_INPUT_AUDIO
    }

    /** Mensaje accionable si falta la clave: qué variable rellenar y dónde obtenerla. */
    public String missingKeyMessage(String selectorVar) {
        return "%s=%s requiere %s: crea una clave gratuita en %s y añádela a .env."
                .formatted(selectorVar, id, keyEnvVar, keyUrl);
    }

    /** Cliente HTTP con timeouts explícitos y la clave en la cabecera. */
    public RestClient restClient() {
        return restClient(settings);
    }

    public static RestClient restClient(OpenAiCompatibleProperties settings) {
        var httpClient = HttpClient.newBuilder().connectTimeout(settings.connectTimeout()).build();
        var requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(settings.readTimeout());
        return RestClient.builder()
                .baseUrl(settings.baseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + settings.apiKey())
                .build();
    }
}

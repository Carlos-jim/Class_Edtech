package com.edtech.tutor.speech.infra;

import com.edtech.tutor.shared.ai.OpenAiCompatibleProperties;
import com.edtech.tutor.speech.domain.AudioClip;
import com.edtech.tutor.speech.domain.AudioFormat;
import com.edtech.tutor.speech.domain.TranscriptionPort;
import com.edtech.tutor.speech.domain.TranscriptionUnavailableException;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * Transcripción a través del chat compatible con OpenAI: el audio va en un mensaje ({@code input_audio}) con la
 * instrucción de transcribirlo literalmente. Para proveedores sin {@code /audio/transcriptions} (Gemini).
 *
 * <p>Solo admite WAV y MP3 (lo que acepta esta vía). El frontend convierte la grabación a WAV antes de subirla.
 */
public class ChatAudioTranscriptionAdapter implements TranscriptionPort {

    private static final Logger log = LoggerFactory.getLogger(ChatAudioTranscriptionAdapter.class);

    static final String INSTRUCTIONS = """
            Transcribe literalmente el audio en español. Devuelve solo el texto transcrito, sin comillas ni \
            comentarios. Escribe exactamente las palabras dichas: no las cambies por otras parecidas ni reformules. \
            No respondas a la pregunta del audio: solo transcríbela. Si no hay voz, devuelve una cadena vacía.""";

    private static final Map<AudioFormat, String> SUPPORTED = Map.of(AudioFormat.WAV, "wav", AudioFormat.MP3, "mp3");

    // --- Contrato HTTP OpenAI (chat completions con audio) -----------------------------------------

    record InputAudio(String data, String format) {
    }

    record ContentPart(String type, @JsonProperty("input_audio") InputAudio inputAudio) {
    }

    record ChatMessage(String role, Object content) {
    }

    record ChatRequest(String model, List<ChatMessage> messages, double temperature) {
    }

    record ChatResponse(List<Choice> choices) {

        record Choice(Message message) {
        }

        record Message(String content) {
        }
    }

    // ------------------------------------------------------------------------------------------------

    private final RestClient http;
    private final OpenAiCompatibleProperties properties;
    private final String provider;

    public ChatAudioTranscriptionAdapter(RestClient http, OpenAiCompatibleProperties properties, String provider) {
        this.http = http;
        this.properties = properties;
        this.provider = provider;
    }

    @Override
    public String transcribe(AudioClip clip) {
        var format = SUPPORTED.get(clip.format());
        if (format == null) {
            throw TranscriptionUnavailableException.permanent(
                    provider + " (voz): formato " + clip.format() + " no admitido (solo WAV o MP3)", null);
        }
        var audio = new ContentPart("input_audio", new InputAudio(Base64.getEncoder().encodeToString(clip.data()), format));
        var request = new ChatRequest(properties.transcriptionModel(),
                List.of(new ChatMessage("system", instructions(clip)), new ChatMessage("user", List.of(audio))), 0);

        ChatResponse response;
        try {
            response = http.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(ChatResponse.class);
        } catch (HttpClientErrorException.TooManyRequests ex) {
            throw TranscriptionUnavailableException.retryable(provider + " (voz): límite de peticiones (429)", ex);
        } catch (HttpServerErrorException ex) {
            // 503 "high demand" es frecuente en los planes gratuitos y suele pasar en segundos.
            throw TranscriptionUnavailableException.retryable(
                    provider + " (voz): error del servidor (" + ex.getStatusCode().value() + ")", ex);
        } catch (HttpClientErrorException ex) {
            if (ex.getStatusCode().value() == 401) {
                log.error("{} rechazó la API key (401). Revisa la clave en .env.", provider);
            } else {
                log.warn("{} (voz) HTTP {}: {}", provider, ex.getStatusCode().value(), ex.getResponseBodyAsString());
            }
            throw TranscriptionUnavailableException.permanent(
                    provider + " (voz): petición rechazada (" + ex.getStatusCode().value() + ")", ex);
        } catch (ResourceAccessException ex) {
            throw TranscriptionUnavailableException.retryable(provider + " (voz): sin respuesta a tiempo o error de red", ex);
        }

        if (response == null || response.choices() == null || response.choices().isEmpty()
                || response.choices().getFirst().message() == null) {
            return "";
        }
        var text = response.choices().getFirst().message().content();
        return text == null ? "" : stripWrappingQuotes(text.strip());
    }

    /** Instrucciones + contexto de la lección, si lo hay. */
    static String instructions(AudioClip clip) {
        return clip.hint().isEmpty() ? INSTRUCTIONS : INSTRUCTIONS + "\n\n" + clip.hint().instructions();
    }

    /** Algunos modelos devuelven la transcripción entre comillas pese a la instrucción. */
    static String stripWrappingQuotes(String text) {
        if (text.length() >= 2) {
            var first = text.charAt(0);
            var last = text.charAt(text.length() - 1);
            if ((first == '"' && last == '"') || (first == '«' && last == '»') || (first == '“' && last == '”')) {
                return text.substring(1, text.length() - 1).strip();
            }
        }
        return text;
    }
}

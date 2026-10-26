package com.edtech.tutor.speech.infra;

import com.edtech.tutor.shared.ai.OpenAiCompatibleProperties;
import com.edtech.tutor.speech.domain.AudioClip;
import com.edtech.tutor.speech.domain.TranscriptionPort;
import com.edtech.tutor.speech.domain.TranscriptionUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * Adaptador hacia cualquier API de Audio Transcriptions compatible con OpenAI: Mistral (Voxtral), Groq (Whisper)...
 * Solo envía los campos comunes a todos ({@code file}, {@code model}, {@code language}, {@code temperature}).
 */
public class OpenAiCompatibleTranscriptionAdapter implements TranscriptionPort {

    private static final Logger log = LoggerFactory.getLogger(OpenAiCompatibleTranscriptionAdapter.class);

    record TranscriptionResponse(String text) {
    }

    private final RestClient http;
    private final OpenAiCompatibleProperties properties;
    private final String provider;

    public OpenAiCompatibleTranscriptionAdapter(RestClient http, OpenAiCompatibleProperties properties, String provider) {
        this.http = http;
        this.properties = properties;
        this.provider = provider;
    }

    @Override
    public String transcribe(AudioClip clip) {
        var fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(MediaType.parseMediaType(clip.format().mimeType()));
        fileHeaders.setContentDispositionFormData("file", clip.filename());

        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("file", new HttpEntity<>(new NamedByteArrayResource(clip.data(), clip.filename()), fileHeaders));
        form.add("model", properties.transcriptionModel());
        form.add("language", "es");
        form.add("temperature", "0");

        try {
            var response = http.post()
                    .uri("/audio/transcriptions")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(form)
                    .retrieve()
                    .body(TranscriptionResponse.class);
            return response == null || response.text() == null ? "" : response.text();
        } catch (HttpClientErrorException.TooManyRequests ex) {
            throw TranscriptionUnavailableException.retryable(provider + " (voz): límite de peticiones (429)", ex);
        } catch (HttpServerErrorException ex) {
            throw TranscriptionUnavailableException.retryable(provider + " (voz): error del servidor (" + ex.getStatusCode().value() + ")", ex);
        } catch (HttpClientErrorException ex) {
            if (ex.getStatusCode().value() == 401) {
                log.error("{} rechazó la API key (401). Revisa la clave en .env.", provider);
            } else {
                log.warn("{} (voz) HTTP {}: {}", provider, ex.getStatusCode().value(), ex.getResponseBodyAsString());
            }
            throw TranscriptionUnavailableException.permanent(provider + " (voz): petición rechazada (" + ex.getStatusCode().value() + ")", ex);
        } catch (ResourceAccessException ex) {
            throw TranscriptionUnavailableException.retryable(provider + " (voz): sin respuesta a tiempo o error de red", ex);
        }
    }

    /** El multipart necesita un nombre de fichero; se usa uno generado, nunca el que envía el cliente. */
    private static final class NamedByteArrayResource extends ByteArrayResource {

        private final String filename;

        NamedByteArrayResource(byte[] data, String filename) {
            super(data);
            this.filename = filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }

        @Override
        public boolean equals(Object other) {
            return super.equals(other);
        }

        @Override
        public int hashCode() {
            return super.hashCode();
        }
    }
}

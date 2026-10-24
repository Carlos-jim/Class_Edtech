package com.edtech.tutor.speech.application;

import com.edtech.tutor.shared.web.ApiException;
import com.edtech.tutor.shared.web.ErrorCode;
import com.edtech.tutor.speech.domain.AudioClip;
import com.edtech.tutor.speech.domain.AudioFormat;
import com.edtech.tutor.speech.domain.TranscriptionPort;
import com.edtech.tutor.speech.domain.TranscriptionUnavailableException;
import java.text.Normalizer;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Valida el audio, lo transcribe y limpia el resultado. El texto se devuelve al alumno para que lo revise y edite
 * antes de enviarlo al tutor: aquí no se guarda nada ni se llama al LLM.
 */
@Service
public class TranscriptionService {

    private static final Logger log = LoggerFactory.getLogger(TranscriptionService.class);

    /** Por debajo de este tamaño la grabación es demasiado corta para contener una pregunta. */
    static final int MIN_AUDIO_BYTES = 1024;
    /** Igual que el límite de una pregunta escrita. */
    static final int MAX_TRANSCRIPT_CHARS = 2000;
    private static final int MAX_ATTEMPTS = 2;

    /**
     * Frases que Whisper "alucina" con silencio o ruido (artefactos de sus datos de entrenamiento, subtítulos de
     * vídeos). Si la transcripción es solo eso, se trata como "no se detectó voz".
     */
    private static final List<String> KNOWN_HALLUCINATIONS = List.of(
            "amara org", "subtitulos realizados por", "subtitulado por", "gracias por ver el video",
            "gracias por ver", "suscribete al canal", "musica");

    private final TranscriptionPort transcriber;
    private final SpeechProperties properties;

    public TranscriptionService(TranscriptionPort transcriber, SpeechProperties properties) {
        this.transcriber = transcriber;
        this.properties = properties;
    }

    public String transcribe(byte[] audio) {
        if (audio == null || audio.length == 0) {
            throw new ApiException(ErrorCode.AUDIO_INVALID, "No se ha recibido ningún audio");
        }
        if (audio.length > properties.maxAudioSize().toBytes()) {
            throw new ApiException(ErrorCode.AUDIO_TOO_LARGE);
        }
        if (audio.length < MIN_AUDIO_BYTES) {
            throw new ApiException(ErrorCode.NO_SPEECH_DETECTED, "La grabación es demasiado corta. Mantén pulsado y formula tu pregunta");
        }
        var format = AudioFormat.detect(audio).orElseThrow(() -> new ApiException(ErrorCode.AUDIO_INVALID));

        var text = clean(transcribeWithRetry(new AudioClip(audio, format)));
        if (text.isEmpty() || isHallucination(text)) {
            throw new ApiException(ErrorCode.NO_SPEECH_DETECTED);
        }
        return text.length() > MAX_TRANSCRIPT_CHARS ? text.substring(0, MAX_TRANSCRIPT_CHARS) : text;
    }

    private String transcribeWithRetry(AudioClip clip) {
        for (int attempt = 1; ; attempt++) {
            try {
                var text = transcriber.transcribe(clip);
                return text == null ? "" : text;
            } catch (TranscriptionUnavailableException ex) {
                if (!ex.isRetryable() || attempt >= MAX_ATTEMPTS) {
                    log.warn("Transcripción no disponible tras {} intento(s): {}", attempt, ex.getMessage());
                    throw new ApiException(ErrorCode.TRANSCRIPTION_UNAVAILABLE);
                }
            }
        }
    }

    private static String clean(String text) {
        return text.replaceAll("\\s+", " ").strip();
    }

    static boolean isHallucination(String text) {
        var normalized = Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^a-z0-9]+", " ")
                .strip();
        if (normalized.isEmpty()) {
            return true;
        }
        return KNOWN_HALLUCINATIONS.stream().anyMatch(phrase ->
                normalized.equals(phrase) || (phrase.equals("amara org") && normalized.contains(phrase))
                        || (normalized.startsWith(phrase) && normalized.length() < phrase.length() + 30));
    }
}

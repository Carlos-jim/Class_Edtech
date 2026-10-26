package com.edtech.tutor.speech.application;

import com.edtech.tutor.shared.web.ApiException;
import com.edtech.tutor.shared.web.ErrorCode;
import com.edtech.tutor.speech.domain.SpeechSynthesisPort;
import com.edtech.tutor.speech.domain.SpeechSynthesisUnavailableException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Audio de las respuestas del tutor. Las respuestas no cambian, así que se cachean por id de mensaje; un semáforo
 * limita las síntesis simultáneas para que nadie pueda saturar la CPU.
 */
@Service
public class AnswerSpeechService {

    private static final Logger log = LoggerFactory.getLogger(AnswerSpeechService.class);

    /** Respuestas más largas se recortan en un final de frase (un minuto largo de audio). */
    static final int MAX_TEXT_LENGTH = 1500;

    private final SpeechSynthesisPort synthesis;
    private final Semaphore slots;
    private final Map<UUID, byte[]> cache;

    public AnswerSpeechService(SpeechSynthesisPort synthesis, TtsProperties properties) {
        this.synthesis = synthesis;
        this.slots = new Semaphore(Math.max(1, properties.maxConcurrent()));
        var size = Math.max(1, properties.cacheSize());
        this.cache = new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<UUID, byte[]> eldest) {
                return size() > size;
            }
        };
    }

    public byte[] audioFor(UUID messageId, String text) {
        synchronized (cache) {
            var cached = cache.get(messageId);
            if (cached != null) {
                return cached;
            }
        }
        try {
            if (!slots.tryAcquire(10, TimeUnit.SECONDS)) {
                throw new ApiException(ErrorCode.SPEECH_SYNTHESIS_UNAVAILABLE);
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ApiException(ErrorCode.SPEECH_SYNTHESIS_UNAVAILABLE);
        }
        try {
            var audio = synthesis.synthesize(speakable(text));
            synchronized (cache) {
                cache.put(messageId, audio);
            }
            return audio;
        } catch (SpeechSynthesisUnavailableException ex) {
            log.warn("Texto a voz no disponible: {}", ex.getMessage());
            throw new ApiException(ErrorCode.SPEECH_SYNTHESIS_UNAVAILABLE);
        } finally {
            slots.release();
        }
    }

    /** Texto preparado para leer: sin viñetas ni saltos de línea, y acotado en un final de frase. */
    static String speakable(String text) {
        var clean = text.replace('•', ' ').replaceAll("\\s+", " ").strip();
        if (clean.length() <= MAX_TEXT_LENGTH) {
            return clean;
        }
        var cut = clean.substring(0, MAX_TEXT_LENGTH);
        var lastSentence = Math.max(cut.lastIndexOf(". "), Math.max(cut.lastIndexOf("? "), cut.lastIndexOf("! ")));
        return lastSentence > MAX_TEXT_LENGTH / 2 ? cut.substring(0, lastSentence + 1) : cut;
    }
}

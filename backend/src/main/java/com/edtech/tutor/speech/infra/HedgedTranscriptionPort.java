package com.edtech.tutor.speech.infra;

import com.edtech.tutor.shared.ai.Hedging;
import com.edtech.tutor.shared.ai.Hedging.HedgeException;
import com.edtech.tutor.speech.domain.AudioClip;
import com.edtech.tutor.speech.domain.TranscriptionPort;
import com.edtech.tutor.speech.domain.TranscriptionUnavailableException;
import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;

/** Transcribe con varios modelos "en relevo" ({@link Hedging}): gana la primera transcripción que llega. */
public final class HedgedTranscriptionPort implements TranscriptionPort {

    private final List<TranscriptionPort> models;
    private final String provider;
    private final Duration stagger;
    private final Duration deadline;

    public HedgedTranscriptionPort(List<TranscriptionPort> models, String provider, Duration stagger, Duration deadline) {
        this.models = List.copyOf(models);
        this.provider = provider;
        this.stagger = stagger;
        this.deadline = deadline;
    }

    @Override
    public String transcribe(AudioClip clip) {
        try {
            return Hedging.race(models.stream().map(model -> (Supplier<String>) () -> model.transcribe(clip)).toList(),
                    stagger, deadline);
        } catch (HedgeException ex) {
            var reason = ex.deadlineExceeded() ? "ningún modelo respondió a tiempo" : "todos los modelos fallaron";
            throw TranscriptionUnavailableException.permanent(provider + " (voz): " + reason, ex);
        }
    }
}

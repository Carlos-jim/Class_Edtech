package com.edtech.tutor.tutor.infra;

import com.edtech.tutor.shared.ai.Hedging;
import com.edtech.tutor.shared.ai.Hedging.HedgeException;
import com.edtech.tutor.tutor.domain.LlmPort;
import com.edtech.tutor.tutor.domain.LlmUnavailableException;
import com.edtech.tutor.tutor.domain.TutorAnswer;
import com.edtech.tutor.tutor.domain.TutorPrompt;
import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;

/**
 * Decorador que pide la respuesta a varios modelos "en relevo" ({@link Hedging}) y devuelve la primera que llega.
 * Recorta las esperas largas de los planes gratuitos, donde cada modelo tiene su propia cola.
 */
public final class HedgedLlmPort implements LlmPort {

    private final List<LlmPort> models;
    private final String provider;
    private final Duration stagger;
    private final Duration deadline;

    public HedgedLlmPort(List<LlmPort> models, String provider, Duration stagger, Duration deadline) {
        this.models = List.copyOf(models);
        this.provider = provider;
        this.stagger = stagger;
        this.deadline = deadline;
    }

    @Override
    public TutorAnswer answer(TutorPrompt prompt) {
        try {
            return Hedging.race(models.stream().map(model -> (Supplier<TutorAnswer>) () -> model.answer(prompt)).toList(),
                    stagger, deadline);
        } catch (HedgeException ex) {
            // El relevo ya probó todos los modelos: no se reintenta otra vez (el alumno tiene "Reintentar").
            var reason = ex.deadlineExceeded() ? "ningún modelo respondió a tiempo" : "todos los modelos fallaron";
            throw LlmUnavailableException.permanent(provider + ": " + reason, ex);
        }
    }
}

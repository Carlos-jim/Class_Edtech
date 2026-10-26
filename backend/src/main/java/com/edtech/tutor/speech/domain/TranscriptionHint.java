package com.edtech.tutor.speech.domain;

import java.util.List;

/**
 * Contexto para transcribir mejor: de qué lección es la pregunta y qué términos técnicos pueden aparecer. Ayuda al
 * modelo a elegir la palabra con sentido ante un sonido dudoso («explicar» y no «atestiguar») y a escribir bien
 * siglas y términos (HTTP, PATCH, 404 Not Found). No debe usarse para añadir palabras que no se dijeron.
 *
 * @param topic título de la lección
 * @param terms vocabulario de la lección, sin duplicados
 */
public record TranscriptionHint(String topic, List<String> terms) {

    public static final TranscriptionHint NONE = new TranscriptionHint("", List.of());

    /** Límite prudente: el prompt de Whisper admite ~224 tokens. */
    static final int MAX_PROMPT_CHARS = 600;

    public TranscriptionHint {
        topic = topic == null ? "" : topic.strip();
        terms = terms == null ? List.of() : List.copyOf(terms);
    }

    public boolean isEmpty() {
        return topic.isEmpty() && terms.isEmpty();
    }

    /** Frase de contexto para modelos que reciben instrucciones (Gemini). */
    public String instructions() {
        if (isEmpty()) {
            return "";
        }
        return ("Contexto: es la pregunta de un alumno sobre la lección «%s». Términos que pueden aparecer (úsalos solo "
                + "para escribirlos correctamente si se pronuncian; nunca los añadas si no se dicen): %s. Si dudas entre "
                + "dos palabras que suenan parecido, elige la que tenga sentido en una pregunta sobre esta lección.")
                .formatted(topic, String.join(", ", terms));
    }

    /** Texto de ejemplo para el campo {@code prompt} de Whisper (sesga el vocabulario y la ortografía). */
    public String whisperPrompt() {
        if (isEmpty()) {
            return "";
        }
        var prompt = "Pregunta de un alumno sobre «%s»: %s.".formatted(topic, String.join(", ", terms));
        return prompt.length() <= MAX_PROMPT_CHARS ? prompt : prompt.substring(0, MAX_PROMPT_CHARS);
    }
}

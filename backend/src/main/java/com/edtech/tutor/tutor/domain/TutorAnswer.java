package com.edtech.tutor.tutor.domain;

/**
 * Respuesta estructurada del tutor.
 *
 * @param answer    texto para el alumno
 * @param grounded  {@code true} solo si la respuesta se apoya en la lección <em>y</em> la cita se verificó
 * @param citation  fragmento de la lección que respalda la respuesta; {@code null} si no está grounded
 */
public record TutorAnswer(String answer, boolean grounded, String citation) {

    public static final int MAX_CITATION_LENGTH = 500;

    public TutorAnswer {
        if (answer == null || answer.isBlank()) {
            throw new IllegalArgumentException("La respuesta del tutor no puede estar vacía");
        }
        answer = answer.strip();
        if (answer.length() > Message.MAX_CONTENT_LENGTH) {
            answer = answer.substring(0, Message.MAX_CONTENT_LENGTH - 1) + "…";
        }
        if (citation != null) {
            citation = citation.isBlank() ? null : citation.strip();
            if (citation != null && citation.length() > MAX_CITATION_LENGTH) {
                citation = citation.substring(0, MAX_CITATION_LENGTH - 1) + "…";
            }
        }
        if (!grounded) {
            citation = null;
        }
    }

    /** Atajo para respuestas sin cita (p. ej. tests o {@code grounded=false}). */
    public static TutorAnswer of(String answer, boolean grounded) {
        return new TutorAnswer(answer, grounded, null);
    }
}

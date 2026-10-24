package com.edtech.tutor.tutor.domain;

/**
 * Respuesta estructurada del tutor.
 *
 * @param answer   texto para el alumno
 * @param grounded {@code true} si la respuesta se apoya en el contenido de la lección; {@code false} si la lección
 *                 no contiene información suficiente (el texto lo explica)
 */
public record TutorAnswer(String answer, boolean grounded) {

    public TutorAnswer {
        if (answer == null || answer.isBlank()) {
            throw new IllegalArgumentException("La respuesta del tutor no puede estar vacía");
        }
        answer = answer.strip();
        if (answer.length() > Message.MAX_CONTENT_LENGTH) {
            answer = answer.substring(0, Message.MAX_CONTENT_LENGTH - 1) + "…";
        }
    }
}

package com.edtech.tutor.tutor.domain;

import java.util.List;

/**
 * Petición al LLM, independiente del proveedor.
 *
 * @param systemInstructions instrucciones de sistema con la lección delimitada (ver PromptBuilder)
 * @param history            turnos previos de la conversación, del más antiguo al más reciente
 * @param question           pregunta actual del alumno, ya neutralizada
 * @param lesson             la lección en bruto, para adaptadores que no usan el prompt (p. ej. el mock)
 */
public record TutorPrompt(String systemInstructions, List<Turn> history, String question, LessonContext lesson) {

    public TutorPrompt {
        history = List.copyOf(history);
    }

    public record Turn(MessageRole role, String content) {
    }

    public record LessonContext(String title, String content) {
    }
}

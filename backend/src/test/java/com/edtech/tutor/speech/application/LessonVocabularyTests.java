package com.edtech.tutor.speech.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.edtech.tutor.catalog.Lesson;
import com.edtech.tutor.speech.domain.TranscriptionHint;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LessonVocabularyTests {

    static final String CONTENT = """
            ## Los métodos HTTP

            ### POST — Crear

            Sirve para **crear un nuevo recurso** dentro de una colección. Respuesta típica: `201 Created`.

            ## ¿Qué es una API?

            Una API expone recursos como `/productos/7`; si no existe, `404 Not Found`. El formato habitual es JSON.
            """;

    final Lesson lesson = new Lesson(UUID.randomUUID(), 2, "Métodos HTTP", "Resumen", CONTENT, 12);

    @Test
    void extractsHeadingsBoldInlineCodeAndAcronyms() {
        var hint = LessonVocabulary.from(lesson);

        assertThat(hint.topic()).isEqualTo("Métodos HTTP");
        assertThat(hint.terms()).contains(
                "Los métodos HTTP", "POST", "crear un nuevo recurso", "201 Created", "/productos/7", "404 Not Found",
                "HTTP", "API", "JSON");
    }

    @Test
    void ignoresQuestionHeadingsAndDuplicatesCaseInsensitively() {
        var terms = LessonVocabulary.from(lesson).terms();

        assertThat(terms).doesNotContain("¿Qué es una API?");
        assertThat(terms.stream().filter(term -> term.equalsIgnoreCase("post"))).hasSize(1);
    }

    @Test
    void limitsTheNumberOfTerms() {
        var many = new StringBuilder();
        for (int i = 0; i < 100; i++) {
            many.append("**término ").append(i).append("** ");
        }
        var big = new Lesson(UUID.randomUUID(), 1, "T", "R", many.toString(), 5);

        assertThat(LessonVocabulary.from(big).terms()).hasSize(LessonVocabulary.MAX_TERMS);
    }

    @Test
    void hintRendersInstructionsAndABoundedWhisperPrompt() {
        var hint = LessonVocabulary.from(lesson);

        assertThat(hint.instructions())
                .contains("«Métodos HTTP»", "404 Not Found", "nunca los añadas si no se dicen");
        assertThat(hint.whisperPrompt()).startsWith("Pregunta de un alumno sobre «Métodos HTTP»:");
        assertThat(TranscriptionHint.NONE.instructions()).isEmpty();
        assertThat(TranscriptionHint.NONE.whisperPrompt()).isEmpty();

        var long1 = new TranscriptionHint("T", java.util.Collections.nCopies(200, "palabra"));
        assertThat(long1.whisperPrompt()).hasSizeLessThanOrEqualTo(600);
    }
}

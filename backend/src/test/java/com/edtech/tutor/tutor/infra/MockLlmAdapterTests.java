package com.edtech.tutor.tutor.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.tutor.domain.LlmUnavailableException;
import com.edtech.tutor.tutor.domain.TutorPrompt;
import com.edtech.tutor.tutor.domain.TutorPrompt.LessonContext;
import java.util.List;
import org.junit.jupiter.api.Test;

class MockLlmAdapterTests {

    static final String LESSON = """
            ## Los métodos HTTP

            Los métodos indican qué acción se quiere realizar sobre un recurso.

            ### GET — Leer

            Sirve para obtener la representación de un recurso.

            ### POST — Crear

            Sirve para **crear un nuevo recurso** dentro de una colección.

            ```http
            POST /productos
            ```

            - POST **no es idempotente**.

            | Método | Seguro |
            |--------|--------|
            | POST   | No     |
            """;

    final MockLlmAdapter adapter = new MockLlmAdapter();

    @Test
    void answersFromTheMostRelevantSectionAndMarksItGrounded() {
        var answer = adapter.answer(prompt("¿Para qué sirve POST?"));

        assertThat(answer.grounded()).isTrue();
        // Como Groq, cita el Markdown literal: el frontend se encarga de mostrarlo con formato.
        assertThat(answer.citation()).isNotBlank().contains("**crear un nuevo recurso**");
        assertThat(answer.answer())
                .startsWith("Según la lección «Métodos HTTP»:")
                .contains("crear un nuevo recurso", "no es idempotente")
                .doesNotContain("**", "```", "|", "###");
    }

    @Test
    void matchesKeywordsIgnoringCaseAndAccents() {
        assertThat(adapter.answer(prompt("explícame get")).answer()).contains("obtener la representación");
    }

    @Test
    void saysItHasNoInformationWhenTheLessonDoesNotCoverTheQuestion() {
        var answer = adapter.answer(prompt("¿Cuál es la capital de Francia?"));

        assertThat(answer.grounded()).isFalse();
        assertThat(answer.citation()).isNull();
        assertThat(answer.answer()).contains("No encuentro información suficiente", "«Métodos HTTP»");
    }

    @Test
    void questionsMadeOnlyOfStopwordsAreNotGrounded() {
        assertThat(adapter.answer(prompt("¿Para qué sirve?")).grounded()).isFalse();
    }

    @Test
    void failureTriggerSimulatesProviderOutage() {
        assertThatThrownBy(() -> adapter.answer(prompt("hola " + MockLlmAdapter.FAILURE_TRIGGER)))
                .isInstanceOf(LlmUnavailableException.class);
    }

    private static TutorPrompt prompt(String question) {
        return new TutorPrompt("system", List.of(), question, new LessonContext("Métodos HTTP", LESSON));
    }
}

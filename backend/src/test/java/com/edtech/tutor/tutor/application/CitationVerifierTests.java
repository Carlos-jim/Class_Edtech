package com.edtech.tutor.tutor.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.edtech.tutor.tutor.domain.TutorAnswer;
import org.junit.jupiter.api.Test;

class CitationVerifierTests {

    static final String LESSON = """
            ## POST — Crear

            Sirve para **crear un nuevo recurso** dentro de una colección.
            El cliente envía los datos en el cuerpo de la petición.
            """;

    final CitationVerifier verifier = new CitationVerifier();

    @Test
    void acceptsLiteralCitationFromTheLesson() {
        var raw = new TutorAnswer("POST crea recursos en una colección.", true,
                "Sirve para crear un nuevo recurso dentro de una colección.");

        var verified = verifier.verify(raw, LESSON);

        assertThat(verified.grounded()).isTrue();
        assertThat(verified.citation()).contains("crear un nuevo recurso");
    }

    @Test
    void acceptsCitationIgnoringMarkdownAndAccents() {
        var raw = new TutorAnswer("Explicación", true,
                "Sirve para crear un nuevo recurso dentro de una coleccion."); // sin tilde

        assertThat(verifier.verify(raw, LESSON).grounded()).isTrue();
    }

    @Test
    void demotesWhenCitationIsMissing() {
        var raw = TutorAnswer.of("Inventé que POST borra la base de datos.", true);

        var verified = verifier.verify(raw, LESSON);

        assertThat(verified.grounded()).isFalse();
        assertThat(verified.citation()).isNull();
        assertThat(verified.answer()).contains("Inventé");
    }

    @Test
    void demotesWhenCitationIsNotInTheLesson() {
        var raw = new TutorAnswer("París es la capital.", true,
                "París es la capital de Francia y tiene la Torre Eiffel.");

        var verified = verifier.verify(raw, LESSON);

        assertThat(verified.grounded()).isFalse();
        assertThat(verified.citation()).isNull();
    }

    @Test
    void demotesWhenCitationIsTooShort() {
        var raw = new TutorAnswer("Ok", true, "POST crea");

        assertThat(verifier.verify(raw, LESSON).grounded()).isFalse();
    }

    @Test
    void notGroundedAnswersLoseAnyCitation() {
        var raw = new TutorAnswer("No hay datos en la lección.", false, "Sirve para crear un nuevo recurso.");

        var verified = verifier.verify(raw, LESSON);

        assertThat(verified.grounded()).isFalse();
        assertThat(verified.citation()).isNull();
    }
}

package com.edtech.tutor.speech.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.shared.web.ApiException;
import com.edtech.tutor.speech.domain.SpeechSynthesisUnavailableException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnswerSpeechServiceTests {

    private static final TtsProperties PROPS = new TtsProperties("mock", "", "", Duration.ofSeconds(5), 2, 2);

    @Test
    void audioIsCachedPerMessage() {
        List<String> calls = new ArrayList<>();
        var service = new AnswerSpeechService(text -> {
            calls.add(text);
            return text.getBytes();
        }, PROPS);
        var id = UUID.randomUUID();

        service.audioFor(id, "Hola");
        service.audioFor(id, "Hola");

        assertThat(calls).containsExactly("Hola");
    }

    @Test
    void unavailableEngineBecomes503() {
        var service = new AnswerSpeechService(text -> {
            throw new SpeechSynthesisUnavailableException("sin Piper");
        }, PROPS);

        assertThatThrownBy(() -> service.audioFor(UUID.randomUUID(), "Hola"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("No se pudo generar el audio");
    }

    @Test
    void textIsCleanedAndCappedAtASentenceEnd() {
        assertThat(AnswerSpeechService.speakable("• GET lee.\n• POST crea.")).isEqualTo("GET lee. POST crea.");

        var longText = "Frase de prueba bastante larga. ".repeat(100);
        var spoken = AnswerSpeechService.speakable(longText);
        assertThat(spoken).hasSizeLessThanOrEqualTo(AnswerSpeechService.MAX_TEXT_LENGTH).endsWith(".");
    }
}

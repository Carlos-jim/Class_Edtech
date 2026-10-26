package com.edtech.tutor.speech.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.edtech.tutor.speech.application.TtsProperties;
import com.edtech.tutor.speech.domain.SpeechSynthesisUnavailableException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Prueba el adaptador con un "piper" falso (script de shell) que imita su interfaz de línea de comandos. */
class PiperSynthesisAdapterTests {

    @TempDir Path dir;
    Path model;

    @BeforeEach
    void setUp() throws Exception {
        assumeTrue(Files.isExecutable(Path.of("/bin/sh")), "requiere un sistema POSIX");
        model = Files.writeString(dir.resolve("voz.onnx"), "modelo");
    }

    @Test
    void textGoesThroughStdinAndTheWavFileIsReturned() throws Exception {
        // Escribe "RIFF" + 60 bytes + el texto recibido en el fichero indicado con --output_file
        var piper = fakePiper("""
                out=""; while [ $# -gt 0 ]; do [ "$1" = "--output_file" ] && out="$2"; shift; done
                { printf 'RIFF'; head -c 60 /dev/zero; cat; } > "$out"
                """);

        var audio = new PiperSynthesisAdapter(piper, model, Duration.ofSeconds(5)).synthesize("¿Qué es POST?");

        var bytes = new String(audio, java.nio.charset.StandardCharsets.UTF_8);
        assertThat(bytes).startsWith("RIFF").endsWith("¿Qué es POST?");
    }

    @Test
    void failureOrEmptyOutputIsReportedAsUnavailable() throws Exception {
        var failing = fakePiper("exit 3");

        assertThatThrownBy(() -> new PiperSynthesisAdapter(failing, model, Duration.ofSeconds(5)).synthesize("hola"))
                .isInstanceOf(SpeechSynthesisUnavailableException.class);
    }

    @Test
    void slowProcessIsKilledAfterTheTimeout() throws Exception {
        var slow = fakePiper("sleep 10");

        var start = System.nanoTime();
        assertThatThrownBy(() -> new PiperSynthesisAdapter(slow, model, Duration.ofMillis(300)).synthesize("hola"))
                .isInstanceOf(SpeechSynthesisUnavailableException.class)
                .hasMessageContaining("no terminó");
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(5));
    }

    @Test
    void missingPiperFallsBackToTheBrowserVoiceInsteadOfFailingToStart() {
        var props = new TtsProperties("piper", dir.resolve("no-existe").toString(), model.toString(),
                Duration.ofSeconds(5), 1, 1);

        var port = TtsConfig.create(props);

        assertThat(port).isNotInstanceOf(PiperSynthesisAdapter.class);
        assertThatThrownBy(() -> port.synthesize("hola")).isInstanceOf(SpeechSynthesisUnavailableException.class);
    }

    @Test
    void unknownEngineIsRejected() {
        var props = new TtsProperties("espeak", "", "", Duration.ofSeconds(5), 1, 1);

        assertThatThrownBy(() -> TtsConfig.create(props)).hasMessageContaining("piper, none, mock");
    }

    private Path fakePiper(String body) throws Exception {
        var script = Files.writeString(dir.resolve("piper"), "#!/bin/sh\n" + body);
        Files.setPosixFilePermissions(script, PosixFilePermissions.fromString("rwx------"));
        return script;
    }
}

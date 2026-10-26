package com.edtech.tutor.speech.infra;

import com.edtech.tutor.speech.domain.SpeechSynthesisPort;
import com.edtech.tutor.speech.domain.SpeechSynthesisUnavailableException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Texto a voz con Piper (motor neuronal local, MIT) y una voz en español. Sin red, claves ni coste.
 *
 * <p>Se ejecuta como proceso, sin shell (no hay inyección de comandos posible): el texto entra por la entrada estándar
 * y el WAV se escribe en un fichero temporal propio del proceso. Si no termina a tiempo, se mata.
 */
public class PiperSynthesisAdapter implements SpeechSynthesisPort {

    private final Path binary;
    private final Path model;
    private final Duration timeout;

    public PiperSynthesisAdapter(Path binary, Path model, Duration timeout) {
        this.binary = binary;
        this.model = model;
        this.timeout = timeout;
    }

    /** Piper y la voz están instalados (en la imagen Docker; en desarrollo puede no estarlo). */
    public boolean isInstalled() {
        return Files.isExecutable(binary) && Files.isRegularFile(model);
    }

    @Override
    public byte[] synthesize(String text) {
        Path output = null;
        Process process = null;
        try {
            output = Files.createTempFile("tts-", ".wav");
            process = new ProcessBuilder(List.of(binary.toString(), "--model", model.toString(), "--output_file",
                    output.toString()))
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            try (var stdin = process.getOutputStream()) {
                stdin.write(text.getBytes(StandardCharsets.UTF_8));
            }
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                throw new SpeechSynthesisUnavailableException("Piper no terminó en " + timeout.toSeconds() + " s");
            }
            if (process.exitValue() != 0 || Files.size(output) <= 44) {
                throw new SpeechSynthesisUnavailableException("Piper terminó con código " + process.exitValue());
            }
            return Files.readAllBytes(output);
        } catch (IOException ex) {
            throw new SpeechSynthesisUnavailableException("No se pudo ejecutar Piper", ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new SpeechSynthesisUnavailableException("Síntesis interrumpida", ex);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
            if (output != null) {
                try {
                    Files.deleteIfExists(output);
                } catch (IOException ignored) {
                    // fichero temporal: el sistema lo limpiará
                }
            }
        }
    }
}

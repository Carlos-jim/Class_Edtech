package com.edtech.tutor.speech.infra;

import com.edtech.tutor.speech.domain.AudioClip;
import com.edtech.tutor.speech.domain.TranscriptionPort;
import com.edtech.tutor.speech.domain.TranscriptionUnavailableException;
import java.nio.charset.StandardCharsets;

/**
 * Transcripción simulada para ejecutar la demo y los tests sin clave: siempre devuelve la pregunta de ejemplo del
 * enunciado. El alumno puede editar el texto antes de enviarlo, igual que con la transcripción real.
 *
 * <p>Si el audio contiene los bytes {@value #FAILURE_MARKER}, simula una caída del servicio.
 */
public class MockTranscriptionAdapter implements TranscriptionPort {

    public static final String SAMPLE_TRANSCRIPT = "¿Para qué sirve POST?";
    public static final String FAILURE_MARKER = "SIMULAR-FALLO";

    @Override
    public String transcribe(AudioClip clip) {
        if (new String(clip.data(), StandardCharsets.ISO_8859_1).contains(FAILURE_MARKER)) {
            throw TranscriptionUnavailableException.permanent("Fallo simulado de transcripción (modo mock)", null);
        }
        return SAMPLE_TRANSCRIPT;
    }
}

package com.edtech.tutor.speech.domain;

/** No se pudo generar el audio. El navegador puede recurrir a su propia síntesis o el alumno leer la respuesta. */
public class SpeechSynthesisUnavailableException extends RuntimeException {

    public SpeechSynthesisUnavailableException(String message) {
        super(message);
    }

    public SpeechSynthesisUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}

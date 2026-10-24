package com.edtech.tutor.tutor.domain;

/** El servicio de IA no pudo dar una respuesta válida. Es recuperable: el alumno puede reintentar. */
public class LlmUnavailableException extends RuntimeException {

    public LlmUnavailableException(String message) {
        super(message);
    }

    public LlmUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}

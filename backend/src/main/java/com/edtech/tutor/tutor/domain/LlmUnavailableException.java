package com.edtech.tutor.tutor.domain;

/**
 * El servicio de IA no pudo dar una respuesta válida. Para el alumno siempre es recuperable (puede reintentar);
 * {@link #isRetryable()} indica si merece la pena reintentar automáticamente (timeout, 429, 5xx, salida
 * mal formada) o no (credenciales inválidas, petición rechazada, circuito abierto).
 */
public class LlmUnavailableException extends RuntimeException {

    private final boolean retryable;

    public LlmUnavailableException(String message) {
        this(message, null, false);
    }

    public LlmUnavailableException(String message, Throwable cause, boolean retryable) {
        super(message, cause);
        this.retryable = retryable;
    }

    public static LlmUnavailableException retryable(String message, Throwable cause) {
        return new LlmUnavailableException(message, cause, true);
    }

    public static LlmUnavailableException permanent(String message, Throwable cause) {
        return new LlmUnavailableException(message, cause, false);
    }

    public boolean isRetryable() {
        return retryable;
    }
}

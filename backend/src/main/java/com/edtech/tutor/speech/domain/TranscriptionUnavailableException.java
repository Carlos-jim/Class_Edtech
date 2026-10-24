package com.edtech.tutor.speech.domain;

/** El servicio de transcripción falló. {@link #isRetryable()} indica si es un fallo transitorio. */
public class TranscriptionUnavailableException extends RuntimeException {

    private final boolean retryable;

    public TranscriptionUnavailableException(String message, Throwable cause, boolean retryable) {
        super(message, cause);
        this.retryable = retryable;
    }

    public static TranscriptionUnavailableException retryable(String message, Throwable cause) {
        return new TranscriptionUnavailableException(message, cause, true);
    }

    public static TranscriptionUnavailableException permanent(String message, Throwable cause) {
        return new TranscriptionUnavailableException(message, cause, false);
    }

    public boolean isRetryable() {
        return retryable;
    }
}

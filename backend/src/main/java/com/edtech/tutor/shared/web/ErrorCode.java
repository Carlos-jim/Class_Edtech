package com.edtech.tutor.shared.web;

import org.springframework.http.HttpStatus;

/**
 * Códigos de error estables que el frontend usa para decidir qué mostrar y qué acción ofrecer
 * (reintentar, escribir en lugar de hablar, volver a iniciar sesión...).
 */
public enum ErrorCode {
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "Petición no válida"),
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "Hay campos con errores"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Correo o contraseña incorrectos"),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "Autenticación requerida o token no válido"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Recurso no encontrado"),
    AI_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "El tutor no está disponible en este momento. Inténtalo de nuevo en unos segundos"),
    AUDIO_INVALID(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "El archivo no es un audio en un formato admitido (webm, ogg, m4a, wav, mp3)"),
    AUDIO_TOO_LARGE(HttpStatus.valueOf(413), "La grabación es demasiado larga. Graba una pregunta más breve"),
    NO_SPEECH_DETECTED(HttpStatus.valueOf(422), "No se ha detectado voz en la grabación. Inténtalo de nuevo o escribe tu pregunta"),
    TRANSCRIPTION_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "No se pudo transcribir el audio. Inténtalo de nuevo o escribe tu pregunta"),
    SPEECH_SYNTHESIS_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "No se pudo generar el audio de la respuesta. Puedes leerla por escrito"),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Has hecho demasiadas peticiones seguidas. Espera un momento y vuelve a intentarlo"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Error interno. Inténtalo de nuevo más tarde");

    private final HttpStatus status;
    private final String defaultDetail;

    ErrorCode(HttpStatus status, String defaultDetail) {
        this.status = status;
        this.defaultDetail = defaultDetail;
    }

    public HttpStatus status() {
        return status;
    }

    public String defaultDetail() {
        return defaultDetail;
    }
}

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

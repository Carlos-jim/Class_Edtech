package com.edtech.tutor.shared.web;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Límites de uso. Protegen el login frente a fuerza bruta y la cuota del proveedor de IA frente a abusos.
 *
 * @param enabled       permite desactivarlos (p. ej. en pruebas de carga)
 * @param login         por IP
 * @param questions     por alumno (POST /api/lessons/{id}/messages)
 * @param transcriptions por alumno (POST /api/transcriptions)
 */
@ConfigurationProperties("app.rate-limit")
public record RateLimitProperties(boolean enabled, Rule login, Rule questions, Rule transcriptions) {

    public record Rule(int requests, Duration window) {
    }
}

package com.edtech.tutor.auth;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuración del JWT. Se valida al arrancar: sin secreto suficientemente largo la aplicación no inicia.
 *
 * @param secret secreto HMAC-SHA256 (mínimo 32 bytes); viene de la variable de entorno {@code JWT_SECRET}
 * @param ttl    vigencia del token de acceso
 * @param issuer emisor esperado en el claim {@code iss}
 */
@ConfigurationProperties("app.security.jwt")
public record JwtProperties(String secret, Duration ttl, String issuer) {

    static final int MIN_SECRET_BYTES = 32;

    public JwtProperties {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET no definido o demasiado corto (mínimo " + MIN_SECRET_BYTES
                            + " bytes). Genera uno con: openssl rand -base64 48");
        }
        if (ttl == null || ttl.isNegative() || ttl.isZero()) {
            throw new IllegalStateException("app.security.jwt.ttl debe ser positivo");
        }
        if (issuer == null || issuer.isBlank()) {
            throw new IllegalStateException("app.security.jwt.issuer es obligatorio");
        }
    }

    byte[] secretBytes() {
        return secret.getBytes(StandardCharsets.UTF_8);
    }
}

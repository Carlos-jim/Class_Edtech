package com.edtech.tutor.auth;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Orígenes autorizados para llamar a la API desde el navegador (por defecto, el dev server de Angular). */
@ConfigurationProperties("app.cors")
public record CorsProperties(List<String> allowedOrigins) {

    public CorsProperties {
        allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
        if (allowedOrigins.contains("*")) {
            throw new IllegalStateException("app.cors.allowed-origins no admite '*': indica orígenes explícitos");
        }
    }
}

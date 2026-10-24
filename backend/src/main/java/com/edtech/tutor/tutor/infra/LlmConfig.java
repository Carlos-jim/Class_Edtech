package com.edtech.tutor.tutor.infra;

import com.edtech.tutor.tutor.domain.LlmPort;
import com.edtech.tutor.tutor.infra.groq.GroqLlmAdapter;
import com.edtech.tutor.tutor.infra.groq.GroqProperties;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.ObjectMapper;

/**
 * Elige la implementación de {@link LlmPort} según {@code tutor.llm.provider} (Strategy + Factory).
 * Los proveedores reales se envuelven en {@link ResilientLlmPort}; el mock no, porque es local y determinista.
 */
@Configuration
@EnableConfigurationProperties(GroqProperties.class)
class LlmConfig {

    private static final Logger log = LoggerFactory.getLogger(LlmConfig.class);

    @Bean
    LlmPort llmPort(@Value("${tutor.llm.provider:mock}") String provider, GroqProperties groq, ObjectMapper json) {
        return create(provider, groq, json);
    }

    static LlmPort create(String provider, GroqProperties groq, ObjectMapper json) {
        var selected = provider == null ? "mock" : provider.strip().toLowerCase(Locale.ROOT);
        return switch (selected) {
            case "mock" -> {
                log.info("Tutor IA: proveedor MOCK (sin clave, respuestas simuladas)");
                yield new MockLlmAdapter();
            }
            case "groq" -> {
                if (!groq.hasApiKey()) {
                    throw new IllegalStateException(
                            "LLM_PROVIDER=groq requiere GROQ_API_KEY (gratuita en https://console.groq.com/keys). "
                                    + "Usa LLM_PROVIDER=mock para ejecutar sin clave.");
                }
                log.info("Tutor IA: proveedor GROQ, modelo {}", groq.model());
                yield ResilientLlmPort.withDefaults(new GroqLlmAdapter(GroqLlmAdapter.restClient(groq), groq, json), "groq");
            }
            default -> throw new IllegalStateException(
                    "tutor.llm.provider no soportado: '" + provider + "'. Valores válidos: mock, groq");
        };
    }
}

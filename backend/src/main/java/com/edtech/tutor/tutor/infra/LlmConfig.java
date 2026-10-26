package com.edtech.tutor.tutor.infra;

import com.edtech.tutor.shared.ai.AiProviders;
import com.edtech.tutor.tutor.domain.LlmPort;
import com.edtech.tutor.tutor.infra.openai.OpenAiCompatibleLlmAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.ObjectMapper;

/**
 * Elige la implementación de {@link LlmPort} según {@code tutor.llm.provider} (Strategy + Factory).
 * Los proveedores reales (Mistral, Groq) comparten el adaptador compatible con OpenAI y se envuelven en
 * {@link ResilientLlmPort}; el mock no, porque es local y determinista.
 */
@Configuration
class LlmConfig {

    private static final Logger log = LoggerFactory.getLogger(LlmConfig.class);

    @Bean
    LlmPort llmPort(@Value("${tutor.llm.provider:}") String provider, AiProviders providers, ObjectMapper json) {
        return create(provider, providers, json);
    }

    static LlmPort create(String provider, AiProviders providers, ObjectMapper json) {
        var selected = AiProviders.normalize(provider);
        if (AiProviders.MOCK.equals(selected)) {
            log.warn("Tutor IA: proveedor MOCK (respuestas simuladas, solo para tests automáticos)");
            return new MockLlmAdapter();
        }
        var ai = providers.require(selected, "LLM_PROVIDER");
        log.info("Tutor IA: proveedor {}, modelo {}", ai.label(), ai.settings().chatModel());
        var adapter = new OpenAiCompatibleLlmAdapter(ai.restClient(), ai.settings(), json, ai.label());
        return ResilientLlmPort.withDefaults(adapter, ai.id());
    }
}

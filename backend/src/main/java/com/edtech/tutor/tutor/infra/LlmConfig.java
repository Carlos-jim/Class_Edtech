package com.edtech.tutor.tutor.infra;

import com.edtech.tutor.shared.ai.AiProviders;
import com.edtech.tutor.shared.ai.Hedging;
import com.edtech.tutor.tutor.domain.LlmPort;
import com.edtech.tutor.tutor.infra.openai.OpenAiCompatibleLlmAdapter;
import java.util.List;
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
        var models = ai.settings().chatModels();
        log.info("Tutor IA: proveedor {}, modelos {}", ai.label(), models);
        var http = ai.restClient(); // una sola conexión reutilizada por todos los modelos del proveedor
        if (models.size() == 1) {
            return ResilientLlmPort.withDefaults(new OpenAiCompatibleLlmAdapter(http, ai.settings(), json, ai.label()), ai.id());
        }
        // Varios modelos: relevo entre ellos. Sin reintento extra (el relevo ya lo es); el circuit breaker se mantiene.
        List<LlmPort> adapters = models.stream()
                .map(model -> (LlmPort) new OpenAiCompatibleLlmAdapter(http, ai.settings().withChatModel(model), json,
                        ai.label() + " " + model))
                .toList();
        var hedged = new HedgedLlmPort(adapters, ai.label(), Hedging.DEFAULT_STAGGER, Hedging.DEFAULT_DEADLINE);
        return new ResilientLlmPort(hedged, ai.id(), ResilientLlmPort.NO_RETRY, ResilientLlmPort.DEFAULT_CIRCUIT_BREAKER);
    }
}

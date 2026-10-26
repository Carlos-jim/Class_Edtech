package com.edtech.tutor.shared.ai;

import com.edtech.tutor.shared.ai.AiProvider.TranscriptionApi;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/**
 * Registro de proveedores de IA compatibles con OpenAI. Todos comparten los mismos adaptadores; cambiar de proveedor
 * es solo configuración ({@code LLM_PROVIDER}, {@code STT_PROVIDER}). Útil si uno bloquea la red o agota la cuota.
 */
public final class AiProviders {

    /** Proveedor por defecto si {@code LLM_PROVIDER} está vacío. */
    public static final String DEFAULT = "gemini";
    public static final String MOCK = "mock";

    private final Map<String, AiProvider> providers;

    public AiProviders(AiProvider... providers) {
        this.providers = Stream.of(providers)
                .collect(Collectors.toMap(AiProvider::id, provider -> provider, (a, b) -> a, LinkedHashMap::new));
    }

    /** Normaliza el valor configurado: vacío → proveedor por defecto. */
    public static String normalize(String selected) {
        return selected == null || selected.isBlank() ? DEFAULT : selected.strip().toLowerCase(Locale.ROOT);
    }

    /**
     * Proveedor listo para usar. Falla al arrancar, con un mensaje accionable, si no existe o le falta la clave.
     *
     * @param selectorVar variable con la que se eligió (para el mensaje de error)
     */
    public AiProvider require(String id, String selectorVar) {
        var provider = providers.get(id);
        if (provider == null) {
            throw new IllegalStateException("%s no soportado: '%s'. Valores válidos: %s"
                    .formatted(selectorVar, id, supportedValues()));
        }
        if (!provider.settings().hasApiKey()) {
            throw new IllegalStateException(provider.missingKeyMessage(selectorVar));
        }
        return provider;
    }

    public String supportedValues() {
        return Stream.concat(Stream.of(MOCK), providers.keySet().stream()).collect(Collectors.joining(", "));
    }

    @Configuration
    static class Config {

        @Bean
        AiProviders aiProviders(Environment environment) {
            var binder = Binder.get(environment);
            return new AiProviders(
                    provider(binder, "gemini", "Gemini", "GEMINI_API_KEY", "https://aistudio.google.com/apikey",
                            TranscriptionApi.CHAT_INPUT_AUDIO),
                    provider(binder, "groq", "Groq", "GROQ_API_KEY", "https://console.groq.com/keys",
                            TranscriptionApi.AUDIO_TRANSCRIPTIONS),
                    provider(binder, "mistral", "Mistral", "MISTRAL_API_KEY", "https://console.mistral.ai/api-keys",
                            TranscriptionApi.AUDIO_TRANSCRIPTIONS));
        }

        private static AiProvider provider(Binder binder, String id, String label, String keyEnvVar, String keyUrl,
                                           TranscriptionApi transcription) {
            var settings = binder.bind("ai." + id, OpenAiCompatibleProperties.class)
                    .orElseThrow(() -> new IllegalStateException("Falta la configuración ai." + id));
            return new AiProvider(id, label, keyEnvVar, keyUrl, transcription, settings);
        }
    }
}

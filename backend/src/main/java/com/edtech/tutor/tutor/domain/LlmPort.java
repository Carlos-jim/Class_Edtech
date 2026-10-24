package com.edtech.tutor.tutor.domain;

/**
 * Puerto de salida hacia el modelo de lenguaje (arquitectura hexagonal).
 * Implementaciones: MockLlmAdapter (por defecto, sin clave) y GroqLlmAdapter. Se elige por configuración
 * ({@code tutor.llm.provider}), así el dominio no depende de ningún proveedor.
 */
public interface LlmPort {

    /**
     * @throws LlmUnavailableException si el proveedor falla, no responde a tiempo o devuelve algo no interpretable
     */
    TutorAnswer answer(TutorPrompt prompt);
}

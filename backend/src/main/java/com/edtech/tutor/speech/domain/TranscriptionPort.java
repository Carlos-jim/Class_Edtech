package com.edtech.tutor.speech.domain;

/**
 * Puerto de salida hacia el servicio de voz a texto (arquitectura hexagonal).
 * Implementaciones: MockTranscriptionAdapter (sin clave) y GroqWhisperAdapter.
 */
public interface TranscriptionPort {

    /**
     * @return texto transcrito (puede venir vacío si no se detectó voz)
     * @throws TranscriptionUnavailableException si el proveedor falla o no responde a tiempo
     */
    String transcribe(AudioClip clip);
}

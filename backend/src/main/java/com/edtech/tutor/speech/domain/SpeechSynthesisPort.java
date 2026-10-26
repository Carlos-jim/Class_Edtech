package com.edtech.tutor.speech.domain;

/**
 * Puerto de salida hacia un motor de texto a voz (arquitectura hexagonal). Implementación real: Piper, local en el
 * contenedor; en tests, un adaptador simulado.
 */
public interface SpeechSynthesisPort {

    /**
     * @return audio WAV con el texto leído
     * @throws SpeechSynthesisUnavailableException si el motor no está disponible, falla o no termina a tiempo
     */
    byte[] synthesize(String text);
}

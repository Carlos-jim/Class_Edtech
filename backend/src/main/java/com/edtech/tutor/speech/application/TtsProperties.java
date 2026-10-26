package com.edtech.tutor.speech.application;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Texto a voz en el servidor (respaldo cuando el navegador no tiene síntesis de voz).
 *
 * @param engine        piper | mock (tests) | none
 * @param piperBinary   ejecutable de Piper
 * @param piperModel    voz (.onnx, con su .onnx.json al lado)
 * @param timeout       tiempo máximo por síntesis
 * @param maxConcurrent síntesis simultáneas (protege la CPU)
 * @param cacheSize     audios recientes en memoria (escuchar dos veces no vuelve a sintetizar)
 */
@ConfigurationProperties("speech.tts")
public record TtsProperties(String engine, String piperBinary, String piperModel, Duration timeout, int maxConcurrent,
                            int cacheSize) {
}

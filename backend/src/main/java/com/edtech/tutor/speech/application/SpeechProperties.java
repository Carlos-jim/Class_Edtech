package com.edtech.tutor.speech.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

/**
 * @param provider     mock | groq
 * @param maxAudioSize tamaño máximo del audio aceptado (validación de la API, además del límite multipart)
 */
@ConfigurationProperties("speech")
public record SpeechProperties(String provider, DataSize maxAudioSize) {
}

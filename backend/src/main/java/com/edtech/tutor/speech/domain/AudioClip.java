package com.edtech.tutor.speech.domain;

/** Audio ya validado: tamaño dentro de límites y formato detectado por su contenido. */
public record AudioClip(byte[] data, AudioFormat format) {

    public String filename() {
        return "pregunta." + format.extension();
    }
}

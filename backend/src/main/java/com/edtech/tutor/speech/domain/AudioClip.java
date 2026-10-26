package com.edtech.tutor.speech.domain;

/**
 * Audio ya validado: tamaño dentro de límites y formato detectado por su contenido.
 *
 * @param hint contexto opcional de la lección para transcribir mejor ({@link TranscriptionHint#NONE} si no hay)
 */
public record AudioClip(byte[] data, AudioFormat format, TranscriptionHint hint) {

    public AudioClip {
        hint = hint == null ? TranscriptionHint.NONE : hint;
    }

    public AudioClip(byte[] data, AudioFormat format) {
        this(data, format, TranscriptionHint.NONE);
    }

    public String filename() {
        return "pregunta." + format.extension();
    }
}

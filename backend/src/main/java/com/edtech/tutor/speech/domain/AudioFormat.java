package com.edtech.tutor.speech.domain;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Optional;

/**
 * Formatos de audio aceptados. Se detectan por la firma binaria (magic bytes) del contenido, no por el
 * {@code Content-Type} ni el nombre de fichero que envía el cliente, que son falsificables.
 */
public enum AudioFormat {
    WEBM("audio/webm", "webm"), // Chrome, Firefox, Edge (MediaRecorder)
    OGG("audio/ogg", "ogg"),
    MP4("audio/mp4", "m4a"),    // Safari (MediaRecorder)
    WAV("audio/wav", "wav"),
    MP3("audio/mpeg", "mp3");

    private final String mimeType;
    private final String extension;

    AudioFormat(String mimeType, String extension) {
        this.mimeType = mimeType;
        this.extension = extension;
    }

    public String mimeType() {
        return mimeType;
    }

    public String extension() {
        return extension;
    }

    public static Optional<AudioFormat> detect(byte[] data) {
        if (data == null || data.length < 12) {
            return Optional.empty();
        }
        if (startsWith(data, 0, new byte[] {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3})) {
            return Optional.of(WEBM); // EBML (WebM / Matroska)
        }
        if (startsWith(data, 0, ascii("OggS"))) {
            return Optional.of(OGG);
        }
        if (startsWith(data, 0, ascii("RIFF")) && startsWith(data, 8, ascii("WAVE"))) {
            return Optional.of(WAV);
        }
        if (startsWith(data, 4, ascii("ftyp"))) {
            return Optional.of(MP4);
        }
        if (startsWith(data, 0, ascii("ID3")) || ((data[0] & 0xFF) == 0xFF && (data[1] & 0xE0) == 0xE0)) {
            return Optional.of(MP3);
        }
        return Optional.empty();
    }

    private static boolean startsWith(byte[] data, int offset, byte[] signature) {
        return data.length >= offset + signature.length
                && Arrays.equals(data, offset, offset + signature.length, signature, 0, signature.length);
    }

    private static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.US_ASCII);
    }
}

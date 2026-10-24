package com.edtech.tutor.speech;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/** Audio sintético con la firma binaria correcta de cada formato (el contenido no importa al mock). */
public final class TestAudio {

    private TestAudio() {
    }

    public static byte[] webm(int size) {
        return withHeader(size, new byte[] {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3});
    }

    public static byte[] ogg(int size) {
        return withHeader(size, "OggS".getBytes(StandardCharsets.US_ASCII));
    }

    public static byte[] mp4(int size) {
        return withHeader(size, new byte[] {0, 0, 0, 0x20, 'f', 't', 'y', 'p', 'M', '4', 'A', ' '});
    }

    public static byte[] wav(int size) {
        return withHeader(size, "RIFF\0\0\0\0WAVE".getBytes(StandardCharsets.US_ASCII));
    }

    public static byte[] mp3(int size) {
        return withHeader(size, "ID3".getBytes(StandardCharsets.US_ASCII));
    }

    public static byte[] png(int size) {
        return withHeader(size, new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'});
    }

    /** WebM que el mock interpreta como "fallo del servicio". */
    public static byte[] webmThatFails(int size) {
        var data = webm(size);
        var marker = "SIMULAR-FALLO".getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(marker, 0, data, 16, marker.length);
        return data;
    }

    private static byte[] withHeader(int size, byte[] header) {
        var data = new byte[size];
        Arrays.fill(data, (byte) 0x11);
        System.arraycopy(header, 0, data, 0, header.length);
        return data;
    }
}

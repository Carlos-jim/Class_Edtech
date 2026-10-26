package com.edtech.tutor.speech.infra;

import com.edtech.tutor.speech.domain.SpeechSynthesisPort;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** Texto a voz simulado para tests: WAV válido de silencio (≈ 50 ms por palabra). */
public class MockSpeechSynthesisAdapter implements SpeechSynthesisPort {

    private static final int SAMPLE_RATE = 16_000;

    @Override
    public byte[] synthesize(String text) {
        var words = Math.max(1, text.trim().split("\\s+").length);
        var samples = words * SAMPLE_RATE / 20;
        var dataSize = samples * 2;
        var header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        header.put("RIFF".getBytes()).putInt(36 + dataSize).put("WAVE".getBytes()).put("fmt ".getBytes())
                .putInt(16).putShort((short) 1).putShort((short) 1).putInt(SAMPLE_RATE).putInt(SAMPLE_RATE * 2)
                .putShort((short) 2).putShort((short) 16).put("data".getBytes()).putInt(dataSize);
        var wav = new ByteArrayOutputStream(44 + dataSize);
        wav.writeBytes(header.array());
        wav.writeBytes(new byte[dataSize]);
        return wav.toByteArray();
    }
}

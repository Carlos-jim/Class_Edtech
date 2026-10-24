package com.edtech.tutor.speech.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.edtech.tutor.speech.TestAudio;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class AudioFormatTests {

    @Test
    void detectsSupportedFormatsByTheirBinarySignature() {
        assertThat(AudioFormat.detect(TestAudio.webm(64))).contains(AudioFormat.WEBM);
        assertThat(AudioFormat.detect(TestAudio.ogg(64))).contains(AudioFormat.OGG);
        assertThat(AudioFormat.detect(TestAudio.mp4(64))).contains(AudioFormat.MP4);
        assertThat(AudioFormat.detect(TestAudio.wav(64))).contains(AudioFormat.WAV);
        assertThat(AudioFormat.detect(TestAudio.mp3(64))).contains(AudioFormat.MP3);
    }

    @Test
    void rejectsNonAudioContentRegardlessOfWhatTheClientClaims() {
        assertThat(AudioFormat.detect(TestAudio.png(64))).isEmpty();
        assertThat(AudioFormat.detect("<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8))).isEmpty();
        assertThat(AudioFormat.detect("%PDF-1.7 hola mundo".getBytes(StandardCharsets.US_ASCII))).isEmpty();
    }

    @Test
    void rejectsTruncatedOrEmptyInput() {
        assertThat(AudioFormat.detect(null)).isEmpty();
        assertThat(AudioFormat.detect(new byte[0])).isEmpty();
        assertThat(AudioFormat.detect(new byte[] {0x1A, 0x45})).isEmpty();
    }
}

package com.edtech.tutor.speech.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.shared.web.ApiException;
import com.edtech.tutor.shared.web.ErrorCode;
import com.edtech.tutor.speech.TestAudio;
import com.edtech.tutor.speech.domain.AudioClip;
import com.edtech.tutor.speech.domain.AudioFormat;
import com.edtech.tutor.speech.domain.TranscriptionPort;
import com.edtech.tutor.speech.domain.TranscriptionUnavailableException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

class TranscriptionServiceTests {

    static final SpeechProperties PROPS = new SpeechProperties("mock", DataSize.ofKilobytes(64));

    @Test
    void returnsCleanTranscriptAndPassesDetectedFormatToProvider() {
        var fake = new ScriptedTranscriber(() -> "  ¿Para qué\n sirve   POST?  ");
        var service = new TranscriptionService(fake, PROPS);

        assertThat(service.transcribe(TestAudio.mp4(4096))).isEqualTo("¿Para qué sirve POST?");
        assertThat(fake.lastClip.format()).isEqualTo(AudioFormat.MP4);
        assertThat(fake.lastClip.filename()).isEqualTo("pregunta.m4a");
    }

    @Test
    void rejectsEmptyOversizedTooShortOrNonAudioInputWithoutCallingTheProvider() {
        var fake = new ScriptedTranscriber(() -> "nunca");
        var service = new TranscriptionService(fake, PROPS);

        assertCode(() -> service.transcribe(new byte[0]), ErrorCode.AUDIO_INVALID);
        assertCode(() -> service.transcribe(TestAudio.webm(65 * 1024)), ErrorCode.AUDIO_TOO_LARGE);
        assertCode(() -> service.transcribe(TestAudio.webm(500)), ErrorCode.NO_SPEECH_DETECTED);
        assertCode(() -> service.transcribe(TestAudio.png(4096)), ErrorCode.AUDIO_INVALID);
        assertThat(fake.calls).isZero();
    }

    @Test
    void silenceOrWhisperHallucinationsAreReportedAsNoSpeech() {
        for (var output : List.of("", "   ", "...", "Subtítulos realizados por la comunidad de Amara.org",
                "¡Gracias por ver el video!", "Música")) {
            var service = new TranscriptionService(new ScriptedTranscriber(() -> output), PROPS);
            assertCode(() -> service.transcribe(TestAudio.webm(4096)), ErrorCode.NO_SPEECH_DETECTED);
        }
    }

    @Test
    void realQuestionsAreNotMistakenForHallucinations() {
        assertThat(TranscriptionService.isHallucination("¿Qué diferencia hay entre PUT y PATCH?")).isFalse();
        assertThat(TranscriptionService.isHallucination("¿Para qué sirve la música en una API?")).isFalse();
    }

    @Test
    void transientFailureIsRetriedOnce() {
        var fake = new ScriptedTranscriber(
                () -> { throw TranscriptionUnavailableException.retryable("429", null); },
                () -> "¿Qué es REST?");
        var service = new TranscriptionService(fake, PROPS);

        assertThat(service.transcribe(TestAudio.webm(4096))).isEqualTo("¿Qué es REST?");
        assertThat(fake.calls).isEqualTo(2);
    }

    @Test
    void providerFailureBecomesRecoverableApiError() {
        var permanent = new ScriptedTranscriber(() -> { throw TranscriptionUnavailableException.permanent("401", null); });
        assertCode(() -> new TranscriptionService(permanent, PROPS).transcribe(TestAudio.webm(4096)),
                ErrorCode.TRANSCRIPTION_UNAVAILABLE);
        assertThat(permanent.calls).isEqualTo(1);

        var flaky = new ScriptedTranscriber(() -> { throw TranscriptionUnavailableException.retryable("5xx", null); });
        assertCode(() -> new TranscriptionService(flaky, PROPS).transcribe(TestAudio.webm(4096)),
                ErrorCode.TRANSCRIPTION_UNAVAILABLE);
        assertThat(flaky.calls).isEqualTo(2);
    }

    @Test
    void veryLongTranscriptIsCappedToQuestionLimit() {
        var service = new TranscriptionService(new ScriptedTranscriber(() -> "palabra ".repeat(600)), PROPS);

        assertThat(service.transcribe(TestAudio.webm(4096))).hasSize(TranscriptionService.MAX_TRANSCRIPT_CHARS);
    }

    private static void assertCode(Runnable call, ErrorCode code) {
        assertThatThrownBy(call::run)
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).code()).isEqualTo(code));
    }

    static final class ScriptedTranscriber implements TranscriptionPort {

        private final Deque<Supplier<String>> script;
        private Supplier<String> last;
        int calls;
        AudioClip lastClip;

        @SafeVarargs
        ScriptedTranscriber(Supplier<String>... steps) {
            script = new ArrayDeque<>(List.of(steps));
        }

        @Override
        public String transcribe(AudioClip clip) {
            calls++;
            lastClip = clip;
            if (!script.isEmpty()) {
                last = script.poll();
            }
            return last.get();
        }
    }
}

package com.edtech.tutor.speech.api;

import static com.edtech.tutor.SeedData.ANA;
import static com.edtech.tutor.SeedData.BRUNO;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.edtech.tutor.IntegrationTest;
import com.edtech.tutor.TestTokens;
import com.edtech.tutor.speech.TestAudio;
import com.edtech.tutor.speech.infra.MockTranscriptionAdapter;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@IntegrationTest
class TranscriptionApiTests {

    @Autowired MockMvc mvc;
    @Autowired JwtEncoder jwtEncoder;

    @Test
    void transcribesRecordedAudio() throws Exception {
        upload(ANA, audio(TestAudio.webm(8192), "audio/webm;codecs=opus"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value(MockTranscriptionAdapter.SAMPLE_TRANSCRIPT));
    }

    @Test
    void anyAuthenticatedStudentCanTranscribe() throws Exception {
        upload(BRUNO, audio(TestAudio.mp4(8192), "audio/mp4")).andExpect(status().isOk());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(multipart("/api/transcriptions").file(audio(TestAudio.webm(8192), "audio/webm")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void fileDisguisedAsAudioIsRejected() throws Exception {
        upload(ANA, audio(TestAudio.png(8192), "audio/webm"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("AUDIO_INVALID"));
    }

    @Test
    void tooShortRecordingIsReportedAsNoSpeech() throws Exception {
        upload(ANA, audio(TestAudio.webm(200), "audio/webm"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("NO_SPEECH_DETECTED"));
    }

    @Test
    void oversizedAudioIsRejected() throws Exception {
        upload(ANA, audio(TestAudio.webm(5 * 1024 * 1024 + 1), "audio/webm"))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.code").value("AUDIO_TOO_LARGE"));
    }

    @Test
    void missingAudioPartIsBadRequest() throws Exception {
        mvc.perform(multipart("/api/transcriptions")
                        .file(new MockMultipartFile("otro", "x.webm", "audio/webm", TestAudio.webm(4096)))
                        .header(HttpHeaders.AUTHORIZATION, TestTokens.bearer(jwtEncoder, ANA)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void providerOutageIsRecoverable() throws Exception {
        upload(ANA, audio(TestAudio.webmThatFails(8192), "audio/webm"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("TRANSCRIPTION_UNAVAILABLE"));
    }

    private ResultActions upload(UUID studentId, MockMultipartFile file) throws Exception {
        return mvc.perform(multipart("/api/transcriptions").file(file)
                .header(HttpHeaders.AUTHORIZATION, TestTokens.bearer(jwtEncoder, studentId)));
    }

    private static MockMultipartFile audio(byte[] data, String contentType) {
        return new MockMultipartFile("audio", "../../etc/passwd", contentType, data);
    }
}

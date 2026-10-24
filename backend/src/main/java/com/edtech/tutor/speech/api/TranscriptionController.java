package com.edtech.tutor.speech.api;

import com.edtech.tutor.speech.application.TranscriptionService;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Voz a texto. Solo transcribe: el alumno revisa el texto y lo envía al tutor por {@code /api/lessons/{id}/messages}
 * con {@code inputMode=VOICE}. Requiere autenticación (la clave de Groq nunca sale del backend).
 */
@RestController
@RequestMapping("/api/transcriptions")
class TranscriptionController {

    record TranscriptionResponse(String text) {
    }

    private final TranscriptionService transcription;

    TranscriptionController(TranscriptionService transcription) {
        this.transcription = transcription;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    TranscriptionResponse transcribe(@RequestPart("audio") MultipartFile audio) throws IOException {
        return new TranscriptionResponse(transcription.transcribe(audio.getBytes()));
    }
}

package com.edtech.tutor.speech.api;

import com.edtech.tutor.access.AccessPolicy;
import com.edtech.tutor.auth.CurrentStudentId;
import com.edtech.tutor.speech.application.LessonVocabulary;
import com.edtech.tutor.speech.application.TranscriptionService;
import com.edtech.tutor.speech.domain.TranscriptionHint;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Voz a texto. Solo transcribe: el alumno revisa el texto y lo envía al tutor por {@code /api/lessons/{id}/messages}
 * con {@code inputMode=VOICE}. Requiere autenticación (la clave del proveedor nunca sale del backend).
 *
 * <p>Con {@code lessonId} (opcional) se usa el vocabulario de esa lección como contexto para transcribir mejor; se
 * comprueba el acceso igual que en el resto de la API (sin acceso → 404).
 */
@RestController
@RequestMapping("/api/transcriptions")
class TranscriptionController {

    record TranscriptionResponse(String text) {
    }

    private final TranscriptionService transcription;
    private final AccessPolicy accessPolicy;

    TranscriptionController(TranscriptionService transcription, AccessPolicy accessPolicy) {
        this.transcription = transcription;
        this.accessPolicy = accessPolicy;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    TranscriptionResponse transcribe(@CurrentStudentId UUID studentId,
                                     @RequestPart("audio") MultipartFile audio,
                                     @RequestParam(name = "lessonId", required = false) UUID lessonId) throws IOException {
        var hint = lessonId == null
                ? TranscriptionHint.NONE
                : LessonVocabulary.from(accessPolicy.requireLesson(studentId, lessonId));
        return new TranscriptionResponse(transcription.transcribe(audio.getBytes(), hint));
    }
}

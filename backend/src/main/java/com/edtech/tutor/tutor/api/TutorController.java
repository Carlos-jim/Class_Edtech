package com.edtech.tutor.tutor.api;

import com.edtech.tutor.auth.CurrentStudentId;
import com.edtech.tutor.tutor.api.TutorDtos.AskRequest;
import com.edtech.tutor.tutor.api.TutorDtos.AskResponse;
import com.edtech.tutor.tutor.api.TutorDtos.MessageResponse;
import com.edtech.tutor.speech.application.AnswerSpeechService;
import com.edtech.tutor.tutor.application.TutorService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Conversación del alumno autenticado con el tutor en una lección. No hay ids de conversación en la API. */
@RestController
@RequestMapping("/api/lessons/{lessonId}/messages")
class TutorController {

    private static final MediaType AUDIO_WAV = MediaType.parseMediaType("audio/wav");

    private final TutorService tutor;
    private final AnswerSpeechService speech;

    TutorController(TutorService tutor, AnswerSpeechService speech) {
        this.tutor = tutor;
        this.speech = speech;
    }

    @GetMapping
    List<MessageResponse> history(@CurrentStudentId UUID studentId, @PathVariable UUID lessonId) {
        return tutor.history(studentId, lessonId).stream().map(MessageResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    AskResponse ask(@CurrentStudentId UUID studentId, @PathVariable UUID lessonId,
                    @Valid @RequestBody AskRequest request) {
        var exchange = tutor.ask(studentId, lessonId, request.content(), request.inputMode());
        return new AskResponse(MessageResponse.from(exchange.question()), MessageResponse.from(exchange.answer()));
    }

    /** Respuesta leída en voz alta (WAV), para navegadores sin síntesis de voz. Solo respuestas propias del tutor. */
    @GetMapping("/{messageId}/audio")
    ResponseEntity<byte[]> answerAudio(@CurrentStudentId UUID studentId, @PathVariable UUID lessonId,
                                       @PathVariable UUID messageId) {
        var message = tutor.tutorMessage(studentId, lessonId, messageId);
        return ResponseEntity.ok()
                .contentType(AUDIO_WAV)
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
                .body(speech.audioFor(message.getId(), message.getContent()));
    }
}

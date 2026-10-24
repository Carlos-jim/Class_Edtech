package com.edtech.tutor.tutor.api;

import com.edtech.tutor.auth.CurrentStudentId;
import com.edtech.tutor.tutor.api.TutorDtos.AskRequest;
import com.edtech.tutor.tutor.api.TutorDtos.AskResponse;
import com.edtech.tutor.tutor.api.TutorDtos.MessageResponse;
import com.edtech.tutor.tutor.application.TutorService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
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

    private final TutorService tutor;

    TutorController(TutorService tutor) {
        this.tutor = tutor;
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
}

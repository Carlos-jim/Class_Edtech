package com.edtech.tutor.tutor.api;

import com.edtech.tutor.tutor.domain.InputMode;
import com.edtech.tutor.tutor.domain.Message;
import com.edtech.tutor.tutor.domain.MessageRole;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

final class TutorDtos {

    static final int MAX_QUESTION_LENGTH = 2000;

    private TutorDtos() {
    }

    record AskRequest(
            @NotBlank(message = "La pregunta no puede estar vacía")
            @Size(max = MAX_QUESTION_LENGTH, message = "La pregunta no puede superar " + MAX_QUESTION_LENGTH + " caracteres")
            String content,

            @NotNull(message = "Indica si la pregunta fue por texto o por voz")
            InputMode inputMode) {
    }

    /**
     * {@code content} y {@code citation} son texto plano: el frontend los muestra con interpolación (escapado),
     * nunca como HTML. {@code citation} solo aparece en respuestas grounded del tutor.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    record MessageResponse(UUID id, MessageRole role, String content, InputMode inputMode, Boolean grounded,
                           String citation, Instant createdAt) {

        static MessageResponse from(Message message) {
            return new MessageResponse(message.getId(), message.getRole(), message.getContent(),
                    message.getInputMode(), message.getGrounded(), message.getCitation(), message.getCreatedAt());
        }
    }

    record AskResponse(MessageResponse question, MessageResponse answer) {
    }
}

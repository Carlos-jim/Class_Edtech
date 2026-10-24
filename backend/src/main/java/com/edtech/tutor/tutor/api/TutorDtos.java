package com.edtech.tutor.tutor.api;

import com.edtech.tutor.tutor.domain.InputMode;
import com.edtech.tutor.tutor.domain.Message;
import com.edtech.tutor.tutor.domain.MessageRole;
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

    /** {@code content} es texto plano: el frontend lo muestra con interpolación (escapado), nunca como HTML. */
    record MessageResponse(UUID id, MessageRole role, String content, InputMode inputMode, Boolean grounded,
                           Instant createdAt) {

        static MessageResponse from(Message message) {
            return new MessageResponse(message.getId(), message.getRole(), message.getContent(),
                    message.getInputMode(), message.getGrounded(), message.getCreatedAt());
        }
    }

    record AskResponse(MessageResponse question, MessageResponse answer) {
    }
}

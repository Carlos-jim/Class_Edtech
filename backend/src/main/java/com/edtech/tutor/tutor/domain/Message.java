package com.edtech.tutor.tutor.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Mensaje de una conversación. Se crea con las factorías {@link #fromStudent} y {@link #fromTutor},
 * que garantizan la misma invariante que la restricción {@code ck_message_role_fields} de la BD.
 */
@Entity
@Table(name = "message")
public class Message {

    public static final int MAX_CONTENT_LENGTH = 8000;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "conversation_id", nullable = false, updatable = false)
    private UUID conversationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private MessageRole role;

    @Column(nullable = false, updatable = false)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "input_mode", updatable = false)
    private InputMode inputMode;

    @Column(updatable = false)
    private Boolean grounded;

    /** Fragmento verificado de la lección; solo en respuestas grounded del tutor. */
    @Column(updatable = false, length = TutorAnswer.MAX_CITATION_LENGTH)
    private String citation;

    /** Generado por la BD (identity). Solo se usa para ordenar el historial. */
    @Column(insertable = false, updatable = false)
    private Long seq;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Message() {
    }

    private Message(UUID conversationId, MessageRole role, String content, InputMode inputMode, Boolean grounded,
                    String citation) {
        if (content == null || content.isBlank() || content.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("El contenido del mensaje debe tener entre 1 y " + MAX_CONTENT_LENGTH + " caracteres");
        }
        this.conversationId = conversationId;
        this.role = role;
        this.content = content;
        this.inputMode = inputMode;
        this.grounded = grounded;
        this.citation = citation;
    }

    public static Message fromStudent(UUID conversationId, String content, InputMode inputMode) {
        return new Message(conversationId, MessageRole.STUDENT, content, inputMode, null, null);
    }

    public static Message fromTutor(UUID conversationId, String content, boolean grounded, String citation) {
        if (grounded && (citation == null || citation.isBlank())) {
            throw new IllegalArgumentException("Una respuesta grounded requiere una cita verificada de la lección");
        }
        if (!grounded) {
            citation = null;
        } else {
            citation = citation.strip();
            if (citation.length() > TutorAnswer.MAX_CITATION_LENGTH) {
                citation = citation.substring(0, TutorAnswer.MAX_CITATION_LENGTH - 1) + "…";
            }
        }
        return new Message(conversationId, MessageRole.TUTOR, content, null, grounded, citation);
    }

    public UUID getId() {
        return id;
    }

    public UUID getConversationId() {
        return conversationId;
    }

    public MessageRole getRole() {
        return role;
    }

    public String getContent() {
        return content;
    }

    public InputMode getInputMode() {
        return inputMode;
    }

    public Boolean getGrounded() {
        return grounded;
    }

    public String getCitation() {
        return citation;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}

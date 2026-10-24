package com.edtech.tutor.tutor.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    /** Siempre se busca por (alumno, lección): nunca solo por id, para evitar IDOR. */
    Optional<Conversation> findByStudentIdAndLessonId(UUID studentId, UUID lessonId);
}

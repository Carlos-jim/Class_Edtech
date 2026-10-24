package com.edtech.tutor.tutor.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    /** Siempre se busca por (alumno, lección): nunca solo por id, para evitar IDOR. */
    Optional<Conversation> findByStudentIdAndLessonId(UUID studentId, UUID lessonId);

    /** Crea la conversación si no existe. Seguro ante peticiones concurrentes (sin romper la transacción). */
    @Modifying
    @Query(value = """
            INSERT INTO conversation (id, student_id, lesson_id) VALUES (:id, :studentId, :lessonId)
            ON CONFLICT (student_id, lesson_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("id") UUID id, @Param("studentId") UUID studentId, @Param("lessonId") UUID lessonId);
}

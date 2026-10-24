package com.edtech.tutor.catalog;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LessonRepository extends JpaRepository<Lesson, UUID> {

    List<Lesson> findByCourseIdOrderByPositionAsc(UUID courseId);

    List<Lesson> findByCourseIdInOrderByPositionAsc(Collection<UUID> courseIds);

    /** Lección solo si el alumno está matriculado en su curso: la comprobación de acceso va en la misma consulta. */
    @Query("""
            select l from Lesson l
            where l.id = :lessonId and exists (
                select 1 from Enrollment e
                where e.id.courseId = l.courseId and e.id.studentId = :studentId)
            """)
    Optional<Lesson> findAccessible(@Param("lessonId") UUID lessonId, @Param("studentId") UUID studentId);
}

package com.edtech.tutor.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseRepository extends JpaRepository<Course, UUID> {

    @Query("""
            select c from Course c
            where exists (
                select 1 from Enrollment e
                where e.id.courseId = c.id and e.id.studentId = :studentId)
            order by c.title
            """)
    List<Course> findAllEnrolledBy(@Param("studentId") UUID studentId);

    /** Curso solo si el alumno está matriculado: la comprobación de acceso va en la misma consulta. */
    @Query("""
            select c from Course c
            where c.id = :courseId and exists (
                select 1 from Enrollment e
                where e.id.courseId = c.id and e.id.studentId = :studentId)
            """)
    Optional<Course> findEnrolled(@Param("courseId") UUID courseId, @Param("studentId") UUID studentId);
}

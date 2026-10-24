package com.edtech.tutor.catalog;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Enrollment.Id> {

    boolean existsByIdStudentIdAndIdCourseId(UUID studentId, UUID courseId);
}

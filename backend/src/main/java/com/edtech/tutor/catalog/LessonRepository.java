package com.edtech.tutor.catalog;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonRepository extends JpaRepository<Lesson, UUID> {

    List<Lesson> findByCourseIdOrderByPositionAsc(UUID courseId);
}

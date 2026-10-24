package com.edtech.tutor.access;

import com.edtech.tutor.catalog.Course;
import com.edtech.tutor.catalog.CourseRepository;
import com.edtech.tutor.catalog.Lesson;
import com.edtech.tutor.catalog.LessonRepository;
import com.edtech.tutor.shared.web.ApiException;
import com.edtech.tutor.shared.web.ErrorCode;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Punto único de autorización por recurso. Un alumno solo accede a cursos y lecciones en los que está matriculado.
 *
 * <p>Si no hay acceso se responde igual que si el recurso no existiera (404): así no se revela qué ids son válidos
 * y no se puede enumerar contenido ajeno.
 */
@Component
@Transactional(readOnly = true)
public class AccessPolicy {

    static final String COURSE_NOT_AVAILABLE = "El curso no existe o no tienes acceso a él";
    static final String LESSON_NOT_AVAILABLE = "La lección no existe o no tienes acceso a ella";

    private final CourseRepository courses;
    private final LessonRepository lessons;

    public AccessPolicy(CourseRepository courses, LessonRepository lessons) {
        this.courses = courses;
        this.lessons = lessons;
    }

    public Course requireCourse(UUID studentId, UUID courseId) {
        return courses.findEnrolled(courseId, studentId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, COURSE_NOT_AVAILABLE));
    }

    public Lesson requireLesson(UUID studentId, UUID lessonId) {
        return lessons.findAccessible(lessonId, studentId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, LESSON_NOT_AVAILABLE));
    }
}

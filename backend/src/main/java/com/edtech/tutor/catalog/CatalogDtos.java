package com.edtech.tutor.catalog;

import java.util.List;
import java.util.UUID;

/** Contratos HTTP del catálogo. */
public final class CatalogDtos {

    private CatalogDtos() {
    }

    /** Tarjeta de "Mis cursos". */
    public record CourseSummary(
            UUID id, String slug, String title, String description,
            int lessonCount, int totalMinutes, UUID firstLessonId) {
    }

    /** Elemento del temario (sin contenido). */
    public record LessonSummary(UUID id, int position, String title, String summary, int estimatedMinutes) {

        static LessonSummary from(Lesson lesson) {
            return new LessonSummary(lesson.getId(), lesson.getPosition(), lesson.getTitle(),
                    lesson.getSummary(), lesson.getEstimatedMinutes());
        }
    }

    public record CourseDetail(UUID id, String slug, String title, String description, List<LessonSummary> lessons) {
    }

    /** Lección completa. {@code content} es Markdown: el frontend debe sanitizarlo al renderizar. */
    public record LessonDetail(
            UUID id, UUID courseId, String courseTitle, int position, String title, String summary,
            int estimatedMinutes, String content, UUID previousLessonId, UUID nextLessonId) {
    }
}

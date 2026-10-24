package com.edtech.tutor.catalog;

import com.edtech.tutor.access.AccessPolicy;
import com.edtech.tutor.catalog.CatalogDtos.CourseDetail;
import com.edtech.tutor.catalog.CatalogDtos.CourseSummary;
import com.edtech.tutor.catalog.CatalogDtos.LessonDetail;
import com.edtech.tutor.catalog.CatalogDtos.LessonSummary;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
class CatalogService {

    private final CourseRepository courses;
    private final LessonRepository lessons;
    private final AccessPolicy accessPolicy;

    CatalogService(CourseRepository courses, LessonRepository lessons, AccessPolicy accessPolicy) {
        this.courses = courses;
        this.lessons = lessons;
        this.accessPolicy = accessPolicy;
    }

    List<CourseSummary> enrolledCourses(UUID studentId) {
        var enrolled = courses.findAllEnrolledBy(studentId);
        if (enrolled.isEmpty()) {
            return List.of();
        }
        var lessonsByCourse = lessons.findByCourseIdInOrderByPositionAsc(enrolled.stream().map(Course::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(Lesson::getCourseId));

        return enrolled.stream().map(course -> {
            var courseLessons = lessonsByCourse.getOrDefault(course.getId(), List.of());
            return new CourseSummary(
                    course.getId(), course.getSlug(), course.getTitle(), course.getDescription(),
                    courseLessons.size(),
                    courseLessons.stream().mapToInt(Lesson::getEstimatedMinutes).sum(),
                    courseLessons.isEmpty() ? null : courseLessons.getFirst().getId());
        }).toList();
    }

    CourseDetail course(UUID studentId, UUID courseId) {
        var course = accessPolicy.requireCourse(studentId, courseId);
        var syllabus = lessons.findByCourseIdOrderByPositionAsc(course.getId()).stream()
                .map(LessonSummary::from)
                .toList();
        return new CourseDetail(course.getId(), course.getSlug(), course.getTitle(), course.getDescription(), syllabus);
    }

    LessonDetail lesson(UUID studentId, UUID lessonId) {
        var lesson = accessPolicy.requireLesson(studentId, lessonId);
        var course = courses.getReferenceById(lesson.getCourseId());
        var siblings = lessons.findByCourseIdOrderByPositionAsc(lesson.getCourseId());
        var index = IntStream.range(0, siblings.size())
                .filter(i -> siblings.get(i).getId().equals(lesson.getId()))
                .findFirst()
                .orElse(-1);

        return new LessonDetail(
                lesson.getId(), course.getId(), course.getTitle(), lesson.getPosition(), lesson.getTitle(),
                lesson.getSummary(), lesson.getEstimatedMinutes(), lesson.getContent(),
                index > 0 ? siblings.get(index - 1).getId() : null,
                index >= 0 && index < siblings.size() - 1 ? siblings.get(index + 1).getId() : null);
    }
}

package com.edtech.tutor.catalog;

import com.edtech.tutor.auth.CurrentStudentId;
import com.edtech.tutor.catalog.CatalogDtos.CourseDetail;
import com.edtech.tutor.catalog.CatalogDtos.CourseSummary;
import com.edtech.tutor.catalog.CatalogDtos.LessonDetail;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
class CatalogController {

    private final CatalogService catalog;

    CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/courses")
    List<CourseSummary> myCourses(@CurrentStudentId UUID studentId) {
        return catalog.enrolledCourses(studentId);
    }

    @GetMapping("/courses/{courseId}")
    CourseDetail course(@CurrentStudentId UUID studentId, @PathVariable UUID courseId) {
        return catalog.course(studentId, courseId);
    }

    @GetMapping("/lessons/{lessonId}")
    LessonDetail lesson(@CurrentStudentId UUID studentId, @PathVariable UUID lessonId) {
        return catalog.lesson(studentId, lessonId);
    }
}

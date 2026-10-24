package com.edtech.tutor.catalog;

import static com.edtech.tutor.SeedData.ANA;
import static com.edtech.tutor.SeedData.BRUNO;
import static com.edtech.tutor.SeedData.COURSE;
import static com.edtech.tutor.SeedData.LESSON_1;
import static com.edtech.tutor.SeedData.LESSON_2;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.edtech.tutor.IntegrationTest;
import com.edtech.tutor.TestTokens;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@IntegrationTest
class CatalogAccessTests {

    @Autowired MockMvc mvc;
    @Autowired JwtEncoder jwtEncoder;

    // --- Alumno con acceso (Ana) ---------------------------------------------------------------

    @Test
    void enrolledStudentSeesHerCourseWithLessonStats() throws Exception {
        getAs(ANA, "/api/courses")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(COURSE.toString()))
                .andExpect(jsonPath("$[0].title").value("Fundamentos de APIs REST"))
                .andExpect(jsonPath("$[0].lessonCount").value(2))
                .andExpect(jsonPath("$[0].totalMinutes").value(22))
                .andExpect(jsonPath("$[0].firstLessonId").value(LESSON_1.toString()));
    }

    @Test
    void enrolledStudentSeesSyllabusInOrderWithoutContent() throws Exception {
        getAs(ANA, "/api/courses/" + COURSE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lessons", hasSize(2)))
                .andExpect(jsonPath("$.lessons[0].id").value(LESSON_1.toString()))
                .andExpect(jsonPath("$.lessons[1].id").value(LESSON_2.toString()))
                .andExpect(jsonPath("$.lessons[0].content").doesNotExist());
    }

    @Test
    void enrolledStudentReadsLessonWithNavigation() throws Exception {
        getAs(ANA, "/api/lessons/" + LESSON_2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Métodos HTTP: GET, POST, PUT, PATCH y DELETE"))
                .andExpect(jsonPath("$.courseTitle").value("Fundamentos de APIs REST"))
                .andExpect(jsonPath("$.content", containsString("POST")))
                .andExpect(jsonPath("$.previousLessonId").value(LESSON_1.toString()))
                .andExpect(jsonPath("$.nextLessonId").doesNotExist());

        getAs(ANA, "/api/lessons/" + LESSON_1)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previousLessonId").doesNotExist())
                .andExpect(jsonPath("$.nextLessonId").value(LESSON_2.toString()));
    }

    // --- Alumno sin acceso (Bruno): IDOR ------------------------------------------------------

    @Test
    void studentWithoutEnrollmentHasNoCourses() throws Exception {
        getAs(BRUNO, "/api/courses")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void studentWithoutEnrollmentCannotOpenCourseByGuessingItsId() throws Exception {
        getAs(BRUNO, "/api/courses/" + COURSE)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.lessons").doesNotExist());
    }

    @Test
    void studentWithoutEnrollmentCannotReadLessonContent() throws Exception {
        var body = getAs(BRUNO, "/api/lessons/" + LESSON_2)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("POST", "Métodos HTTP", COURSE.toString());
    }

    @Test
    void forbiddenAndNonexistentLessonsAreIndistinguishable() throws Exception {
        var forbidden = getAs(BRUNO, "/api/lessons/" + LESSON_1)
                .andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
        var nonexistent = getAs(ANA, "/api/lessons/" + UUID.randomUUID())
                .andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();

        assertThat(withoutInstance(forbidden)).isEqualTo(withoutInstance(nonexistent));
    }

    // --- Entradas inválidas y sin autenticar ---------------------------------------------------

    @Test
    void malformedIdReturnsBadRequest() throws Exception {
        getAs(ANA, "/api/lessons/1 OR 1=1")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void catalogRequiresAuthentication() throws Exception {
        for (var path : new String[] {"/api/courses", "/api/courses/" + COURSE, "/api/lessons/" + LESSON_1}) {
            mvc.perform(get(path))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        }
    }

    // --- helpers -----------------------------------------------------------------------------

    private ResultActions getAs(UUID studentId, String path) throws Exception {
        return mvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, TestTokens.bearer(jwtEncoder, studentId)));
    }

    /** {@code instance} contiene la ruta pedida, que lógicamente difiere; el resto debe ser idéntico. */
    private static String withoutInstance(String problemJson) {
        return problemJson.replaceAll("\"instance\":\"[^\"]*\",?", "");
    }
}

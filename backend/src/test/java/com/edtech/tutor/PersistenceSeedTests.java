package com.edtech.tutor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.catalog.CourseRepository;
import com.edtech.tutor.catalog.EnrollmentRepository;
import com.edtech.tutor.catalog.Lesson;
import com.edtech.tutor.catalog.LessonRepository;
import com.edtech.tutor.student.StudentRepository;
import com.edtech.tutor.tutor.domain.Conversation;
import com.edtech.tutor.tutor.domain.ConversationRepository;
import com.edtech.tutor.tutor.domain.InputMode;
import com.edtech.tutor.tutor.domain.Message;
import com.edtech.tutor.tutor.domain.MessageRepository;
import com.edtech.tutor.tutor.domain.MessageRole;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

@IntegrationTest
@Transactional
class PersistenceSeedTests {

    static final UUID ANA = UUID.fromString("a1b2c3d4-0000-4000-8000-000000000001");
    static final UUID BRUNO = UUID.fromString("a1b2c3d4-0000-4000-8000-000000000002");
    static final UUID COURSE = UUID.fromString("c0000000-0000-4000-8000-000000000001");
    static final UUID LESSON_1 = UUID.fromString("e0000000-0000-4000-8000-000000000001");

    @Autowired StudentRepository students;
    @Autowired CourseRepository courses;
    @Autowired LessonRepository lessons;
    @Autowired EnrollmentRepository enrollments;
    @Autowired ConversationRepository conversations;
    @Autowired MessageRepository messages;
    @Autowired JdbcTemplate jdbc;

    @Test
    void seedHasTwoStudentsWithWorkingDemoPassword() {
        var encoder = new BCryptPasswordEncoder();

        var ana = students.findByEmailIgnoreCase("ANA.GARCIA@demo.edtech").orElseThrow();
        var bruno = students.findByEmailIgnoreCase("bruno.lopez@demo.edtech").orElseThrow();

        assertThat(ana.getId()).isEqualTo(ANA);
        assertThat(bruno.getId()).isEqualTo(BRUNO);
        assertThat(encoder.matches("Demo1234!", ana.getPasswordHash())).isTrue();
        assertThat(encoder.matches("otra", ana.getPasswordHash())).isFalse();
    }

    @Test
    void onlyAnaIsEnrolledInTheCourse() {
        assertThat(enrollments.existsByIdStudentIdAndIdCourseId(ANA, COURSE)).isTrue();
        assertThat(enrollments.existsByIdStudentIdAndIdCourseId(BRUNO, COURSE)).isFalse();

        assertThat(courses.findAllEnrolledBy(ANA)).extracting("id").containsExactly(COURSE);
        assertThat(courses.findAllEnrolledBy(BRUNO)).isEmpty();
    }

    @Test
    void courseHasTwoOrderedLessonsWithContent() {
        var courseLessons = lessons.findByCourseIdOrderByPositionAsc(COURSE);

        assertThat(courseLessons).extracting(Lesson::getPosition).containsExactly(1, 2);
        assertThat(courseLessons).allSatisfy(l -> assertThat(l.getContent()).hasSizeGreaterThan(500));
        assertThat(courseLessons.get(1).getContent()).contains("POST");
    }

    @Test
    void conversationHistoryIsScopedToStudentAndLesson() {
        var conversation = conversations.saveAndFlush(new Conversation(ANA, LESSON_1));
        messages.save(Message.fromStudent(conversation.getId(), "¿Para qué sirve POST?", InputMode.VOICE));
        messages.save(Message.fromTutor(conversation.getId(), "POST sirve para crear recursos.", true));
        messages.flush();

        var history = messages.findByConversationIdOrderByCreatedAtAsc(conversation.getId());

        assertThat(history).extracting(Message::getRole).containsExactly(MessageRole.STUDENT, MessageRole.TUTOR);
        assertThat(conversations.findByStudentIdAndLessonId(ANA, LESSON_1)).isPresent();
        assertThat(conversations.findByStudentIdAndLessonId(BRUNO, LESSON_1)).isEmpty();
        assertThat(conversation.isOwnedBy(BRUNO)).isFalse();
    }

    @Test
    void databaseRejectsSecondConversationForSameStudentAndLesson() {
        conversations.saveAndFlush(new Conversation(ANA, LESSON_1));

        assertThatThrownBy(() -> conversations.saveAndFlush(new Conversation(ANA, LESSON_1)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void databaseRejectsTutorMessageWithoutGroundedFlag() {
        var conversation = conversations.saveAndFlush(new Conversation(ANA, LESSON_1));

        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO message (id, conversation_id, role, content) VALUES (?, ?, 'TUTOR', 'x')",
                UUID.randomUUID(), conversation.getId()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void messageFactoryRejectsBlankOrOversizedContent() {
        var conversationId = UUID.randomUUID();

        assertThatThrownBy(() -> Message.fromStudent(conversationId, "  ", InputMode.TEXT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Message.fromTutor(conversationId, "a".repeat(Message.MAX_CONTENT_LENGTH + 1), true))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

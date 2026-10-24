package com.edtech.tutor.tutor.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/** Hilo de conversación de un alumno con el tutor en una lección (único por alumno y lección). */
@Entity
@Table(name = "conversation")
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "student_id", nullable = false, updatable = false)
    private UUID studentId;

    @Column(name = "lesson_id", nullable = false, updatable = false)
    private UUID lessonId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Conversation() {
    }

    public Conversation(UUID studentId, UUID lessonId) {
        this.studentId = studentId;
        this.lessonId = lessonId;
    }

    public boolean isOwnedBy(UUID candidateStudentId) {
        return studentId.equals(candidateStudentId);
    }

    public UUID getId() {
        return id;
    }

    public UUID getStudentId() {
        return studentId;
    }

    public UUID getLessonId() {
        return lessonId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}

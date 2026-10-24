package com.edtech.tutor.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "enrollment")
public class Enrollment {

    @Embeddable
    public record Id(
            @Column(name = "student_id", nullable = false) UUID studentId,
            @Column(name = "course_id", nullable = false) UUID courseId) {
    }

    @EmbeddedId
    private Id id;

    @CreationTimestamp
    @Column(name = "enrolled_at", nullable = false, updatable = false)
    private Instant enrolledAt;

    protected Enrollment() {
    }

    public Enrollment(UUID studentId, UUID courseId) {
        this.id = new Id(studentId, courseId);
    }

    public Id getId() {
        return id;
    }

    public Instant getEnrolledAt() {
        return enrolledAt;
    }
}

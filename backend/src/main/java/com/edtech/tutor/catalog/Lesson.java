package com.edtech.tutor.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "lesson")
public class Lesson {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "course_id", nullable = false)
    private UUID courseId;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String summary;

    /** Contenido en Markdown. Es también el contexto que recibe el tutor IA. */
    @Column(nullable = false)
    private String content;

    @Column(name = "estimated_minutes", nullable = false)
    private int estimatedMinutes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Lesson() {
    }

    public Lesson(UUID courseId, int position, String title, String summary, String content, int estimatedMinutes) {
        this.courseId = courseId;
        this.position = position;
        this.title = title;
        this.summary = summary;
        this.content = content;
        this.estimatedMinutes = estimatedMinutes;
    }

    public UUID getId() {
        return id;
    }

    public UUID getCourseId() {
        return courseId;
    }

    public int getPosition() {
        return position;
    }

    public String getTitle() {
        return title;
    }

    public String getSummary() {
        return summary;
    }

    public String getContent() {
        return content;
    }

    public int getEstimatedMinutes() {
        return estimatedMinutes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}

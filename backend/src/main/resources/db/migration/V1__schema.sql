-- Esquema base del LMS + tutor IA.
-- UUID como clave primaria: no enumerable. El control de acceso real está en la capa de aplicación.

CREATE TABLE student (
    id            UUID PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    display_name  VARCHAR(120) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE course (
    id          UUID PRIMARY KEY,
    slug        VARCHAR(120) NOT NULL UNIQUE,
    title       VARCHAR(200) NOT NULL,
    description TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE lesson (
    id                 UUID PRIMARY KEY,
    course_id          UUID         NOT NULL REFERENCES course (id) ON DELETE CASCADE,
    position           INT          NOT NULL CHECK (position > 0),
    title              VARCHAR(200) NOT NULL,
    summary            VARCHAR(500) NOT NULL,
    content            TEXT         NOT NULL, -- Markdown
    estimated_minutes  INT          NOT NULL CHECK (estimated_minutes > 0),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_lesson_position UNIQUE (course_id, position)
);

CREATE TABLE enrollment (
    student_id  UUID        NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    course_id   UUID        NOT NULL REFERENCES course (id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, course_id)
);

-- Una conversación por alumno y lección: permite retomar el historial.
CREATE TABLE conversation (
    id         UUID PRIMARY KEY,
    student_id UUID        NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    lesson_id  UUID        NOT NULL REFERENCES lesson (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_conversation_student_lesson UNIQUE (student_id, lesson_id)
);

CREATE TABLE message (
    id              UUID PRIMARY KEY,
    conversation_id UUID        NOT NULL REFERENCES conversation (id) ON DELETE CASCADE,
    role            VARCHAR(10) NOT NULL CHECK (role IN ('STUDENT', 'TUTOR')),
    content         TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 8000),
    input_mode      VARCHAR(10) CHECK (input_mode IN ('TEXT', 'VOICE')), -- solo mensajes del alumno
    grounded        BOOLEAN,                                              -- solo mensajes del tutor
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_message_role_fields CHECK (
        (role = 'STUDENT' AND input_mode IS NOT NULL AND grounded IS NULL) OR
        (role = 'TUTOR'   AND input_mode IS NULL     AND grounded IS NOT NULL)
    )
);

CREATE INDEX ix_message_conversation_created ON message (conversation_id, created_at);
CREATE INDEX ix_enrollment_course ON enrollment (course_id);

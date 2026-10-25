-- Fragmento de la lección que respalda una respuesta grounded del tutor (verificado en aplicación).
ALTER TABLE message ADD COLUMN citation TEXT
    CHECK (citation IS NULL OR char_length(citation) BETWEEN 1 AND 500);

-- Respuestas antiguas marcadas grounded sin cita: no podemos inventar el fragmento → degradar.
UPDATE message SET grounded = FALSE WHERE role = 'TUTOR' AND grounded IS TRUE AND citation IS NULL;

ALTER TABLE message DROP CONSTRAINT ck_message_role_fields;
ALTER TABLE message ADD CONSTRAINT ck_message_role_fields CHECK (
    (role = 'STUDENT' AND input_mode IS NOT NULL AND grounded IS NULL AND citation IS NULL) OR
    (role = 'TUTOR'   AND input_mode IS NULL     AND grounded IS NOT NULL
        AND (grounded = FALSE OR citation IS NOT NULL)
        AND (grounded = TRUE  OR citation IS NULL))
);

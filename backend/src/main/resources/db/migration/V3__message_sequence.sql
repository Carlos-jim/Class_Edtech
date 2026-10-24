-- Orden total y estable del historial. La pregunta y la respuesta se guardan en la misma transacción y
-- pueden compartir created_at; seq garantiza que la pregunta siempre va antes que su respuesta.
ALTER TABLE message ADD COLUMN seq BIGINT GENERATED ALWAYS AS IDENTITY;

DROP INDEX ix_message_conversation_created;
CREATE INDEX ix_message_conversation_seq ON message (conversation_id, seq);

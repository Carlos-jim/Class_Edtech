package com.edtech.tutor.tutor.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByConversationIdOrderBySeqAsc(UUID conversationId);

    /** Últimos mensajes (más reciente primero): ventana de contexto para el LLM. */
    List<Message> findTop10ByConversationIdOrderBySeqDesc(UUID conversationId);
}

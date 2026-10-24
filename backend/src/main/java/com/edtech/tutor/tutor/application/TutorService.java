package com.edtech.tutor.tutor.application;

import com.edtech.tutor.access.AccessPolicy;
import com.edtech.tutor.shared.web.ApiException;
import com.edtech.tutor.shared.web.ErrorCode;
import com.edtech.tutor.tutor.domain.ConversationRepository;
import com.edtech.tutor.tutor.domain.InputMode;
import com.edtech.tutor.tutor.domain.LlmPort;
import com.edtech.tutor.tutor.domain.LlmUnavailableException;
import com.edtech.tutor.tutor.domain.Message;
import com.edtech.tutor.tutor.domain.MessageRepository;
import com.edtech.tutor.tutor.domain.TutorAnswer;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Orquesta el recorrido del tutor (Facade / Application Service):
 * acceso → contexto (lección + historial) → LLM → persistencia.
 *
 * <p>La llamada al LLM se hace fuera de transacción para no retener una conexión a BD mientras la IA responde.
 * Pregunta y respuesta se guardan juntas solo si la IA responde: si falla, el historial no queda con preguntas
 * huérfanas y el alumno puede reintentar sin duplicados.
 */
@Service
public class TutorService {

    private static final Logger log = LoggerFactory.getLogger(TutorService.class);

    public record Exchange(Message question, Message answer) {
    }

    private final AccessPolicy accessPolicy;
    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final PromptBuilder promptBuilder;
    private final LlmPort llm;
    private final TransactionTemplate readTx;
    private final TransactionTemplate writeTx;

    public TutorService(AccessPolicy accessPolicy, ConversationRepository conversations, MessageRepository messages,
                        PromptBuilder promptBuilder, LlmPort llm, PlatformTransactionManager transactionManager) {
        this.accessPolicy = accessPolicy;
        this.conversations = conversations;
        this.messages = messages;
        this.promptBuilder = promptBuilder;
        this.llm = llm;
        this.readTx = new TransactionTemplate(transactionManager);
        this.readTx.setReadOnly(true);
        this.writeTx = new TransactionTemplate(transactionManager);
    }

    /** Historial completo del alumno en la lección (vacío si aún no ha preguntado). */
    public List<Message> history(UUID studentId, UUID lessonId) {
        return readTx.execute(status -> {
            accessPolicy.requireLesson(studentId, lessonId);
            return conversations.findByStudentIdAndLessonId(studentId, lessonId)
                    .map(conversation -> messages.findByConversationIdOrderBySeqAsc(conversation.getId()))
                    .orElse(List.of());
        });
    }

    public Exchange ask(UUID studentId, UUID lessonId, String question, InputMode inputMode) {
        var prompt = readTx.execute(status -> {
            var lesson = accessPolicy.requireLesson(studentId, lessonId);
            var recent = conversations.findByStudentIdAndLessonId(studentId, lessonId)
                    .map(conversation -> messages.findTop10ByConversationIdOrderBySeqDesc(conversation.getId()).reversed())
                    .orElse(List.of());
            return promptBuilder.build(lesson, recent, question);
        });

        TutorAnswer answer;
        try {
            answer = llm.answer(prompt);
        } catch (LlmUnavailableException ex) {
            log.warn("Tutor IA no disponible (alumno={}, lección={}): {}", studentId, lessonId, ex.getMessage());
            throw new ApiException(ErrorCode.AI_UNAVAILABLE);
        }

        return writeTx.execute(status -> {
            conversations.insertIfAbsent(UUID.randomUUID(), studentId, lessonId);
            var conversation = conversations.findByStudentIdAndLessonId(studentId, lessonId).orElseThrow();
            var savedQuestion = messages.save(Message.fromStudent(conversation.getId(), question.strip(), inputMode));
            var savedAnswer = messages.save(Message.fromTutor(conversation.getId(), answer.answer(), answer.grounded()));
            return new Exchange(savedQuestion, savedAnswer);
        });
    }
}

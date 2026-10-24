import { AskResponse, ChatMessage } from '../app/core/api/tutor-api';

export function studentMessage(content: string, id = `q-${content}`): ChatMessage {
  return { id, role: 'STUDENT', content, inputMode: 'TEXT', grounded: null, createdAt: '2026-10-24T10:00:00Z' };
}

export function tutorMessage(content: string, grounded = true, id = `a-${content}`): ChatMessage {
  return { id, role: 'TUTOR', content, inputMode: null, grounded, createdAt: '2026-10-24T10:00:01Z' };
}

export function askResponse(question: string, answer: string, grounded = true): AskResponse {
  return { question: studentMessage(question), answer: tutorMessage(answer, grounded) };
}

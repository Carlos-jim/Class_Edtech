import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type MessageRole = 'STUDENT' | 'TUTOR';
export type InputMode = 'TEXT' | 'VOICE';

export interface ChatMessage {
  readonly id: string;
  readonly role: MessageRole;
  /** Texto plano: se muestra con interpolación (escapado), nunca como HTML. */
  readonly content: string;
  readonly inputMode: InputMode | null;
  /** Solo en mensajes del tutor: si la respuesta se basa en la lección (cita verificada). */
  readonly grounded: boolean | null;
  /** Fragmento verificado de la lección; solo si grounded === true. */
  readonly citation: string | null;
  readonly createdAt: string;
}

export interface AskResponse {
  readonly question: ChatMessage;
  readonly answer: ChatMessage;
}

export const MAX_QUESTION_LENGTH = 2000;

/** Conversación del alumno autenticado en una lección. No hay ids de conversación: la identidad va en el token. */
@Injectable({ providedIn: 'root' })
export class TutorApi {
  private readonly http = inject(HttpClient);

  history(lessonId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`/api/lessons/${encodeURIComponent(lessonId)}/messages`);
  }

  ask(lessonId: string, content: string, inputMode: InputMode): Observable<AskResponse> {
    return this.http.post<AskResponse>(`/api/lessons/${encodeURIComponent(lessonId)}/messages`, { content, inputMode });
  }

  /** Respuesta del tutor leída en voz alta (WAV generado en el servidor), para navegadores sin voces. */
  answerAudio(lessonId: string, messageId: string): Observable<Blob> {
    return this.http.get(
      `/api/lessons/${encodeURIComponent(lessonId)}/messages/${encodeURIComponent(messageId)}/audio`,
      { responseType: 'blob' },
    );
  }
}

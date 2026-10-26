import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { toApiError } from '../api/api-error';
import { TutorApi } from '../api/tutor-api';

export interface AnswerAudioFailure {
  readonly id: string;
  readonly code: string;
}

/**
 * Reproduce el audio de una respuesta generado en el servidor (Piper). Es la alternativa cuando el navegador no tiene
 * voces en español. El audio se pide con el token (HttpClient) y se reproduce desde un object URL (CSP: media-src blob:).
 */
@Injectable({ providedIn: 'root' })
export class AnswerAudioPlayer {
  private readonly api = inject(TutorApi);

  /** Respuesta que se está preparando o reproduciendo. */
  readonly speakingId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly failure = signal<AnswerAudioFailure | null>(null);

  private request?: Subscription;
  private audio?: HTMLAudioElement;
  private url?: string;

  play(lessonId: string, id: string): void {
    this.stop();
    this.failure.set(null);
    this.speakingId.set(id);
    this.loading.set(true);
    this.request = this.api.answerAudio(lessonId, id).subscribe({
      next: (blob) => {
        this.loading.set(false);
        this.url = URL.createObjectURL(blob);
        const audio = new Audio(this.url);
        this.audio = audio;
        audio.onended = () => this.finished(id);
        audio.onerror = () => this.fail(id, 'PLAYBACK_FAILED');
        audio.play().catch((error: unknown) => {
          // Reproducción automática bloqueada (sin interacción reciente): el alumno puede pulsar «Escuchar».
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            this.finished(id);
          } else if (!(error instanceof DOMException && error.name === 'AbortError')) {
            this.fail(id, 'PLAYBACK_FAILED');
          }
        });
      },
      error: (error: unknown) => this.fail(id, toApiError(error).code),
    });
  }

  stop(): void {
    this.request?.unsubscribe();
    this.request = undefined;
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio = undefined;
    }
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = undefined;
    }
    this.loading.set(false);
    this.speakingId.set(null);
  }

  private finished(id: string): void {
    if (this.speakingId() === id) {
      this.stop();
    }
  }

  private fail(id: string, code: string): void {
    if (this.speakingId() !== id) {
      return;
    }
    this.stop();
    this.failure.set({ id, code });
  }
}

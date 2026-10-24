import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError, NETWORK_ERROR, toApiError } from '../../core/api/api-error';
import { ChatMessage, InputMode, MAX_QUESTION_LENGTH, TutorApi } from '../../core/api/tutor-api';

/**
 * Fases de la interacción con el tutor (patrón State). Solo se permiten las transiciones de {@link TRANSITIONS}:
 * así la UI no puede, por ejemplo, enviar mientras graba o grabar mientras espera una respuesta.
 */
export type TutorPhase = 'loading' | 'idle' | 'recording' | 'transcribing' | 'reviewing' | 'sending';

export const TRANSITIONS: Readonly<Record<TutorPhase, readonly TutorPhase[]>> = {
  loading: ['idle'],
  idle: ['loading', 'sending', 'recording'],
  recording: ['transcribing', 'idle'],
  transcribing: ['reviewing', 'idle'],
  reviewing: ['sending', 'recording', 'idle'],
  sending: ['idle'],
};

export type TutorErrorKind = 'history' | 'send' | 'microphone' | 'transcription';

export interface TutorError {
  readonly kind: TutorErrorKind;
  readonly code: string;
  readonly message: string;
}

export interface PendingQuestion {
  readonly content: string;
  readonly inputMode: InputMode;
}

/** Estado del panel del tutor para una lección. Se provee a nivel de componente (una instancia por pantalla). */
@Injectable()
export class TutorStore {
  private readonly api = inject(TutorApi);

  private lessonId: string | null = null;
  private historyRequest?: Subscription;
  private sendRequest?: Subscription;

  readonly phase = signal<TutorPhase>('loading');
  readonly messages = signal<readonly ChatMessage[]>([]);
  readonly pending = signal<PendingQuestion | null>(null);
  readonly error = signal<TutorError | null>(null);
  readonly draft = signal('');
  /** VOICE si el borrador viene de una transcripción (aunque el alumno lo edite). */
  readonly draftMode = signal<InputMode>('TEXT');

  readonly isBusy = computed(() => ['loading', 'sending', 'recording', 'transcribing'].includes(this.phase()));
  readonly draftLength = computed(() => this.draft().trim().length);
  readonly canSend = computed(
    () =>
      (this.phase() === 'idle' || this.phase() === 'reviewing') &&
      this.draftLength() > 0 &&
      this.draftLength() <= MAX_QUESTION_LENGTH,
  );
  readonly statusText = computed(() => STATUS_TEXT[this.phase()]);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.historyRequest?.unsubscribe();
      this.sendRequest?.unsubscribe();
    });
  }

  load(lessonId: string): void {
    this.lessonId = lessonId;
    this.historyRequest?.unsubscribe();
    this.sendRequest?.unsubscribe();
    this.phase.set('loading');
    this.messages.set([]);
    this.pending.set(null);
    this.error.set(null);
    this.draft.set('');
    this.draftMode.set('TEXT');

    this.historyRequest = this.api.history(lessonId).subscribe({
      next: (messages) => {
        this.messages.set(messages);
        this.transition('idle');
      },
      error: (error: unknown) => {
        this.fail('history', toApiError(error));
        this.transition('idle');
      },
    });
  }

  updateDraft(value: string): void {
    this.draft.set(value);
    if (!value.trim()) {
      this.draftMode.set('TEXT');
    }
  }

  send(): void {
    if (!this.canSend() || !this.lessonId) {
      return;
    }
    const question: PendingQuestion = { content: this.draft().trim(), inputMode: this.draftMode() };
    this.transition('sending');
    this.error.set(null);
    this.pending.set(question);
    this.draft.set('');

    this.sendRequest = this.api.ask(this.lessonId, question.content, question.inputMode).subscribe({
      next: ({ question: saved, answer }) => {
        this.messages.update((current) => [...current, saved, answer]);
        this.pending.set(null);
        this.draftMode.set('TEXT');
        this.transition('idle');
      },
      error: (error: unknown) => {
        // El backend no guarda nada si falla: se devuelve la pregunta al cuadro de texto para reintentar.
        this.pending.set(null);
        this.draft.set(question.content);
        this.draftMode.set(question.inputMode);
        this.fail('send', toApiError(error));
        this.transition('idle');
      },
    });
  }

  /** Acción del banner de error: recargar el historial o reenviar la pregunta. */
  retry(): void {
    const kind = this.error()?.kind;
    if (kind === 'history' && this.lessonId) {
      this.load(this.lessonId);
    } else if (kind === 'send') {
      this.send();
    } else {
      this.error.set(null);
    }
  }

  dismissError(): void {
    this.error.set(null);
  }

  /** Cambio de fase validado. Devuelve false (y no cambia nada) si la transición no está permitida. */
  transition(to: TutorPhase): boolean {
    const from = this.phase();
    if (from === to) {
      return true;
    }
    if (!TRANSITIONS[from].includes(to)) {
      console.warn(`TutorStore: transición no permitida ${from} → ${to}`);
      return false;
    }
    this.phase.set(to);
    return true;
  }

  fail(kind: TutorErrorKind, error: ApiError): void {
    this.error.set({ kind, code: error.code, message: friendlyMessage(kind, error) });
  }
}

const STATUS_TEXT: Readonly<Record<TutorPhase, string>> = {
  loading: 'Cargando conversación…',
  idle: '',
  recording: 'Escuchando…',
  transcribing: 'Transcribiendo tu pregunta…',
  reviewing: 'Revisa la transcripción y envíala',
  sending: 'El tutor está pensando…',
};

function friendlyMessage(kind: TutorErrorKind, error: ApiError): string {
  if (error.code === NETWORK_ERROR) {
    return 'No hay conexión con el servidor. Tu pregunta no se ha perdido: reinténtalo cuando vuelva la conexión.';
  }
  if (kind === 'history') {
    return 'No se pudo cargar tu conversación anterior.';
  }
  return error.detail;
}

import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError, NETWORK_ERROR, toApiError } from '../../core/api/api-error';
import { TranscriptionApi } from '../../core/api/transcription-api';
import { ChatMessage, InputMode, MAX_QUESTION_LENGTH, TutorApi } from '../../core/api/tutor-api';
import { AudioRecorder, MAX_RECORDING_SECONDS, MicrophoneError, MicrophoneErrorKind } from '../../core/voice/audio-recorder';
import { SpeechPlayer } from '../../core/voice/speech-player';

/**
 * Fases de la interacción con el tutor (patrón State). Solo se permiten las transiciones de {@link TRANSITIONS}:
 * así la UI no puede, por ejemplo, enviar mientras graba o grabar mientras espera una respuesta.
 */
export type TutorPhase = 'loading' | 'idle' | 'recording' | 'transcribing' | 'reviewing' | 'sending';

export const TRANSITIONS: Readonly<Record<TutorPhase, readonly TutorPhase[]>> = {
  loading: ['idle'],
  idle: ['loading', 'sending', 'recording', 'transcribing'], // transcribing: reintento con el audio guardado
  recording: ['transcribing', 'idle'],
  transcribing: ['reviewing', 'idle'],
  reviewing: ['sending', 'recording', 'idle'],
  sending: ['idle'],
};

export type TutorErrorKind = 'history' | 'send' | 'microphone' | 'transcription' | 'speech';

export interface TutorError {
  readonly kind: TutorErrorKind;
  readonly code: string;
  readonly message: string;
  /** Texto del botón de acción del banner. */
  readonly actionLabel: string;
}

export interface PendingQuestion {
  readonly content: string;
  readonly inputMode: InputMode;
}

/** Estado del panel del tutor para una lección. Se provee a nivel de componente (una instancia por pantalla). */
@Injectable()
export class TutorStore {
  private readonly api = inject(TutorApi);
  private readonly transcriptionApi = inject(TranscriptionApi);
  private readonly recorder = inject(AudioRecorder);
  private readonly speech = inject(SpeechPlayer);

  private lessonId: string | null = null;
  private historyRequest?: Subscription;
  private sendRequest?: Subscription;
  private transcriptionRequest?: Subscription;
  /** Última grabación: permite reintentar la transcripción sin volver a grabar. */
  private lastAudio: Blob | null = null;

  readonly phase = signal<TutorPhase>('loading');
  readonly messages = signal<readonly ChatMessage[]>([]);
  readonly pending = signal<PendingQuestion | null>(null);
  readonly error = signal<TutorError | null>(null);
  readonly draft = signal('');
  /** VOICE si el borrador viene de una transcripción (aunque el alumno lo edite). */
  readonly draftMode = signal<InputMode>('TEXT');
  readonly requestingMicrophone = signal(false);
  /** La IA está tardando más de lo habitual (planes gratuitos con picos de demanda): se avisa al alumno. */
  readonly slow = signal(false);
  private slowTimer?: ReturnType<typeof setTimeout>;

  readonly microphoneSupported = this.recorder.isSupported;
  readonly speechSupported = this.speech.isSupported;
  readonly recordingSeconds = this.recorder.elapsedSeconds;
  readonly recordingLevel = this.recorder.level;
  readonly maxRecordingSeconds = MAX_RECORDING_SECONDS;
  readonly speakingId = this.speech.speakingId;

  readonly isBusy = computed(() => ['loading', 'sending', 'recording', 'transcribing'].includes(this.phase()));
  readonly draftLength = computed(() => this.draft().trim().length);
  readonly canSend = computed(
    () =>
      (this.phase() === 'idle' || this.phase() === 'reviewing') &&
      this.draftLength() > 0 &&
      this.draftLength() <= MAX_QUESTION_LENGTH,
  );
  readonly canRecord = computed(
    () => this.microphoneSupported && !this.requestingMicrophone() && (this.phase() === 'idle' || this.phase() === 'reviewing'),
  );
  readonly statusText = computed(() => {
    if (this.requestingMicrophone()) {
      return 'Solicitando acceso al micrófono…';
    }
    if (this.slow()) {
      return SLOW_TEXT[this.phase()] ?? STATUS_TEXT[this.phase()];
    }
    const text = STATUS_TEXT[this.phase()];
    if (!text && this.speakingId()) {
      return 'Reproduciendo respuesta…';
    }
    return text;
  });

  constructor() {
    // La síntesis de voz falla en silencio (navegador sin voces): se avisa en lugar de dejar al alumno esperando.
    effect(() => {
      if (this.speech.failure()) {
        untracked(() =>
          this.error.set({ kind: 'speech', code: 'SPEECH_UNAVAILABLE', message: SPEECH_UNAVAILABLE, actionLabel: 'Reintentar' }),
        );
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.historyRequest?.unsubscribe();
      this.sendRequest?.unsubscribe();
      this.transcriptionRequest?.unsubscribe();
      this.recorder.cancel();
      this.speech.stop();
      clearTimeout(this.slowTimer);
    });
  }

  // --- Historial -----------------------------------------------------------------------------

  load(lessonId: string): void {
    this.lessonId = lessonId;
    this.historyRequest?.unsubscribe();
    this.sendRequest?.unsubscribe();
    this.transcriptionRequest?.unsubscribe();
    this.recorder.cancel();
    this.speech.stop();
    this.phase.set('loading');
    this.messages.set([]);
    this.pending.set(null);
    this.error.set(null);
    this.draft.set('');
    this.draftMode.set('TEXT');
    this.lastAudio = null;

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

  // --- Texto ---------------------------------------------------------------------------------

  updateDraft(value: string): void {
    this.draft.set(value);
    if (!value.trim()) {
      this.draftMode.set('TEXT');
      if (this.phase() === 'reviewing') {
        this.transition('idle');
      }
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
    this.speech.stop();

    this.sendRequest = this.api.ask(this.lessonId, question.content, question.inputMode).subscribe({
      next: ({ question: saved, answer }) => {
        this.messages.update((current) => [...current, saved, answer]);
        this.pending.set(null);
        this.draftMode.set('TEXT');
        this.transition('idle');
        // Conversación por voz: la respuesta se lee en voz alta (también hay botón para escucharla de nuevo).
        if (question.inputMode === 'VOICE') {
          if (this.speechSupported) {
            this.speech.speak(answer.id, answer.content);
          } else {
            this.warnSpeechUnsupported();
          }
        }
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

  // --- Voz -----------------------------------------------------------------------------------

  async startRecording(): Promise<void> {
    if (!this.canRecord()) {
      return;
    }
    this.speech.stop(); // que el altavoz no se grabe a sí mismo
    this.error.set(null);
    this.lastAudio = null;
    this.requestingMicrophone.set(true);
    try {
      await this.recorder.start({ onLimitReached: () => void this.stopRecording() });
      this.transition('recording');
    } catch (error) {
      const kind: MicrophoneErrorKind = error instanceof MicrophoneError ? error.kind : 'unknown';
      this.error.set({ kind: 'microphone', code: kind, message: MICROPHONE_MESSAGES[kind], actionLabel: 'Escribir en su lugar' });
    } finally {
      this.requestingMicrophone.set(false);
    }
  }

  async stopRecording(): Promise<void> {
    if (this.phase() !== 'recording') {
      return;
    }
    this.transition('transcribing');
    try {
      this.lastAudio = await this.recorder.stop();
    } catch {
      this.error.set({ kind: 'microphone', code: 'unknown', message: MICROPHONE_MESSAGES.unknown, actionLabel: 'Escribir en su lugar' });
      this.transition('idle');
      return;
    }
    this.transcribe(this.lastAudio);
  }

  cancelRecording(): void {
    if (this.phase() !== 'recording') {
      return;
    }
    this.recorder.cancel();
    this.transition(this.draft().trim() ? 'reviewing' : 'idle');
  }

  toggleSpeech(message: ChatMessage): void {
    if (!this.speechSupported) {
      this.warnSpeechUnsupported();
      return;
    }
    if (this.error()?.kind === 'speech') {
      this.error.set(null);
    }
    this.speech.toggle(message.id, message.content);
  }

  /** Sin Web Speech API (desactivada en algunos Firefox/LibreWolf o navegadores Flatpak) no hay nada que reintentar. */
  private warnSpeechUnsupported(): void {
    this.error.set({ kind: 'speech', code: 'SPEECH_UNSUPPORTED', message: SPEECH_UNSUPPORTED, actionLabel: 'Entendido' });
  }

  private transcribe(audio: Blob): void {
    this.transcriptionRequest = this.transcriptionApi.transcribe(audio, this.lessonId).subscribe({
      next: ({ text }) => {
        this.lastAudio = null;
        this.draft.set(text);
        this.draftMode.set('VOICE');
        this.transition('reviewing');
      },
      error: (error: unknown) => {
        const apiError = toApiError(error);
        // Solo merece la pena reenviar el mismo audio si el fallo fue del servicio o de la red.
        if (!RETRYABLE_TRANSCRIPTION.has(apiError.code)) {
          this.lastAudio = null;
        }
        this.fail('transcription', apiError);
        this.transition('idle');
      },
    });
  }

  // --- Errores -------------------------------------------------------------------------------

  /** Acción del banner de error, según el tipo de fallo. */
  retry(): void {
    const kind = this.error()?.kind;
    if (kind === 'history' && this.lessonId) {
      this.load(this.lessonId);
    } else if (kind === 'send') {
      this.send();
    } else if (kind === 'transcription') {
      if (this.lastAudio && this.transition('transcribing')) {
        this.error.set(null);
        this.transcribe(this.lastAudio);
      } else {
        void this.startRecording();
      }
    } else if (kind === 'speech') {
      this.error.set(null);
      const failed = this.speech.failure();
      if (failed) {
        this.speech.speak(failed.id, failed.text);
      }
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
    this.watchForSlowness(to);
    return true;
  }

  private watchForSlowness(phase: TutorPhase): void {
    clearTimeout(this.slowTimer);
    this.slow.set(false);
    if (phase === 'sending' || phase === 'transcribing') {
      this.slowTimer = setTimeout(() => this.slow.set(true), SLOW_AFTER_MS);
    }
  }

  private fail(kind: TutorErrorKind, error: ApiError): void {
    this.error.set({
      kind,
      code: error.code,
      message: friendlyMessage(kind, error),
      actionLabel: kind === 'transcription' && !this.lastAudio ? 'Grabar de nuevo' : 'Reintentar',
    });
  }
}

const RETRYABLE_TRANSCRIPTION = new Set([NETWORK_ERROR, 'TRANSCRIPTION_UNAVAILABLE', 'RATE_LIMITED', 'INTERNAL_ERROR']);

/** A partir de aquí se avisa de que la respuesta tarda más de lo normal. */
export const SLOW_AFTER_MS = 8_000;

const SLOW_TEXT: Readonly<Partial<Record<TutorPhase, string>>> = {
  sending: 'El tutor está tardando más de lo normal; seguimos intentándolo…',
  transcribing: 'La transcripción está tardando más de lo normal; seguimos intentándolo…',
};

const STATUS_TEXT: Readonly<Record<TutorPhase, string>> = {
  loading: 'Cargando conversación…',
  idle: '',
  recording: 'Escuchando… pulsa detener cuando termines',
  transcribing: 'Transcribiendo tu pregunta…',
  reviewing: 'Revisa la transcripción, corrígela si hace falta y envíala',
  sending: 'El tutor está pensando…',
};

const SPEECH_UNAVAILABLE =
  'Tu navegador no ha podido leer la respuesta en voz alta: no tiene voces de síntesis disponibles. ' +
  'Prueba con Chrome, Edge o Firefox (en Linux necesitan speech-dispatcher). La respuesta sigue disponible por escrito.';

const SPEECH_UNSUPPORTED =
  'Este navegador no permite leer respuestas en voz alta (la síntesis de voz no está disponible o está desactivada). ' +
  'Prueba con Chrome o Edge. La respuesta sigue disponible por escrito.';

const MICROPHONE_MESSAGES: Readonly<Record<MicrophoneErrorKind, string>> = {
  'permission-denied':
    'No tenemos permiso para usar el micrófono. Actívalo en la configuración del navegador o escribe tu pregunta.',
  'no-microphone': 'No se ha encontrado ningún micrófono. Conecta uno o escribe tu pregunta.',
  busy: 'El micrófono está siendo usado por otra aplicación. Ciérrala o escribe tu pregunta.',
  unsupported: 'Tu navegador no permite grabar audio. Escribe tu pregunta.',
  'insecure-context': 'La grabación de voz requiere una conexión segura (HTTPS). Escribe tu pregunta.',
  unknown: 'No se pudo usar el micrófono. Inténtalo de nuevo o escribe tu pregunta.',
};

function friendlyMessage(kind: TutorErrorKind, error: ApiError): string {
  if (error.code === NETWORK_ERROR) {
    return kind === 'transcription'
      ? 'No hay conexión con el servidor. Tu grabación se ha guardado: reinténtalo cuando vuelva la conexión.'
      : 'No hay conexión con el servidor. Tu pregunta no se ha perdido: reinténtalo cuando vuelva la conexión.';
  }
  if (kind === 'history') {
    return 'No se pudo cargar tu conversación anterior.';
  }
  return error.detail;
}

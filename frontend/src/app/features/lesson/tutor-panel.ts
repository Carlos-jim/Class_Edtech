import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ChatMessage, MAX_QUESTION_LENGTH } from '../../core/api/tutor-api';
import { AlertBanner } from '../../shared/ui/alert-banner';
import { Icon } from '../../shared/ui/icon';
import { ChatMessageView } from './chat-message';
import { TutorStore } from './tutor-store';

/** Panel del tutor junto a la lección (patrón Khanmigo): estado, historial, sugerencias y cuadro de pregunta. */
@Component({
  selector: 'app-tutor-panel',
  imports: [ChatMessageView, AlertBanner, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full min-h-0 flex-col bg-white' },
  template: `
    <header class="flex items-center gap-3 border-b border-slate-200 px-5 py-3.5">
      <span class="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
        <app-icon name="sparkles" [size]="16" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold text-slate-900">Tutor IA</h2>
        <p class="truncate text-xs text-slate-500">Responde con el contenido de esta lección</p>
      </div>
      @if (closable()) {
        <button type="button" class="btn-ghost p-1.5" aria-label="Cerrar tutor" (click)="closed.emit()">
          <app-icon name="x" [size]="18" />
        </button>
      }
    </header>

    <!-- Estado de la interacción (lectores de pantalla incluidos) -->
    <div class="min-h-0 border-b border-slate-100 px-5 text-xs text-brand-700" aria-live="polite" data-testid="tutor-status">
      @if (store.statusText(); as status) {
        <p class="flex items-center gap-2 py-2">
          <app-icon name="loader-circle" [size]="14" class="animate-spin" /> {{ status }}
        </p>
      }
    </div>

    <div #scroller class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5" data-testid="tutor-messages">
      @if (store.phase() === 'loading') {
        <div class="space-y-4" aria-hidden="true">
          <div class="skeleton ml-auto h-10 w-2/3 rounded-2xl"></div>
          <div class="skeleton h-20 w-4/5 rounded-2xl"></div>
        </div>
      } @else {
        @if (store.messages().length === 0 && !store.pending()) {
          <div class="py-6 text-center" data-testid="tutor-empty">
            <span class="mx-auto grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600">
              <app-icon name="sparkles" [size]="22" />
            </span>
            <p class="mt-3 text-sm font-medium text-slate-900">¿Tienes dudas sobre la lección?</p>
            <p class="mt-1 text-xs text-slate-500">Pregúntame por escrito o por voz. Si la lección no lo cubre, te lo diré.</p>
            <div class="mt-5 flex flex-col gap-2">
              @for (suggestion of suggestions(); track suggestion) {
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-brand-500 hover:bg-brand-50"
                  (click)="ask(suggestion)"
                >
                  {{ suggestion }}
                </button>
              }
            </div>
          </div>
        }

        @for (message of store.messages(); track message.id) {
          <app-chat-message [message]="message">
            @if (message.role === 'TUTOR' && store.speechSupported) {
              @let speaking = store.speakingId() === message.id;
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
                [class]="speaking ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'"
                [attr.aria-label]="speaking ? 'Detener lectura de la respuesta' : 'Escuchar respuesta'"
                [attr.aria-pressed]="speaking"
                (click)="store.toggleSpeech(message)"
              >
                <app-icon [name]="speaking ? 'square' : 'volume-2'" [size]="12" />
                {{ speaking ? 'Detener' : 'Escuchar' }}
              </button>
            }
          </app-chat-message>
        }

        @if (pendingMessage(); as pending) {
          <app-chat-message [message]="pending" [pending]="true" />
          <div class="flex gap-2.5" data-testid="tutor-typing" aria-hidden="true">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              <app-icon name="sparkles" [size]="14" />
            </span>
            <div class="flex items-center gap-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3">
              <span class="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></span>
              <span class="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></span>
              <span class="size-1.5 animate-bounce rounded-full bg-slate-400"></span>
            </div>
          </div>
        }
      }
    </div>

    <footer class="border-t border-slate-200 p-4">
      @if (store.error(); as error) {
        <app-alert-banner
          class="mb-3 block"
          [message]="error.message"
          [icon]="errorIcon()"
          [actionLabel]="error.actionLabel"
          (action)="onErrorAction()"
        />
      }

      @if (store.phase() === 'recording') {
        <div class="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5" data-testid="recording-bar">
          <span class="relative flex size-3" aria-hidden="true">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
            <span class="relative inline-flex size-3 rounded-full bg-rose-600"></span>
          </span>
          <span class="text-sm font-medium tabular-nums text-rose-700">
            {{ formatSeconds(store.recordingSeconds()) }}
            <span class="font-normal text-rose-400">/ {{ formatSeconds(store.maxRecordingSeconds) }}</span>
          </span>
          <div class="flex h-6 flex-1 items-center justify-center gap-0.5" aria-hidden="true">
            @for (bar of levelBars; track $index) {
              <span
                class="w-1 rounded-full bg-rose-400 transition-[height] duration-75"
                [style.height.%]="barHeight(bar)"
              ></span>
            }
          </div>
          <button type="button" class="btn-ghost size-9 p-0 text-rose-700 hover:bg-rose-100" aria-label="Cancelar grabación" (click)="store.cancelRecording()">
            <app-icon name="x" [size]="18" />
          </button>
          <button type="button" class="btn size-9 bg-rose-600 p-0 text-white hover:bg-rose-700" aria-label="Detener y transcribir" (click)="store.stopRecording()">
            <app-icon name="square" [size]="14" />
          </button>
        </div>
      } @else {
        @if (store.phase() === 'reviewing') {
          <p class="mb-2 flex items-center gap-1.5 text-xs font-medium text-brand-700" data-testid="voice-review">
            <app-icon name="pencil" [size]="13" /> Transcrito de tu voz · puedes corregirlo antes de enviar
          </p>
        }
        <form
          class="rounded-xl border bg-white transition-colors focus-within:ring-2"
          [class]="
            store.phase() === 'reviewing'
              ? 'border-brand-500 ring-2 ring-brand-500/20'
              : 'border-slate-300 focus-within:border-brand-500 focus-within:ring-brand-500/20'
          "
          (submit)="$event.preventDefault(); store.send()"
        >
          <label for="tutor-question" class="sr-only">Escribe tu pregunta</label>
          <textarea
            #textarea
            id="tutor-question"
            rows="1"
            class="block max-h-40 w-full resize-none rounded-t-xl border-0 bg-transparent px-3.5 pt-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            [placeholder]="store.phase() === 'transcribing' ? 'Transcribiendo…' : 'Escribe tu pregunta o pulsa el micrófono…'"
            [value]="store.draft()"
            [disabled]="store.isBusy()"
            [attr.maxlength]="maxLength"
            (input)="onInput(textarea)"
            (keydown.enter)="onEnter($any($event))"
          ></textarea>
          <div class="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
            <span class="px-1 text-[11px]" [class]="nearLimit() ? 'text-amber-700' : 'text-slate-500'">
              @if (nearLimit()) {
                {{ store.draftLength() }}/{{ maxLength }}
              } @else {
                Intro para enviar · Mayús+Intro, nueva línea
              }
            </span>
            <div class="flex items-center gap-1.5">
              @if (store.microphoneSupported) {
                <button
                  type="button"
                  class="btn-secondary size-9 p-0"
                  [disabled]="!store.canRecord()"
                  [attr.aria-label]="store.phase() === 'reviewing' ? 'Volver a grabar' : 'Preguntar por voz'"
                  [attr.title]="store.phase() === 'reviewing' ? 'Volver a grabar' : 'Preguntar por voz'"
                  (click)="store.startRecording()"
                >
                  @if (store.phase() === 'transcribing' || store.requestingMicrophone()) {
                    <app-icon name="loader-circle" [size]="16" class="animate-spin" />
                  } @else {
                    <app-icon name="mic" [size]="16" />
                  }
                </button>
              } @else {
                <span class="grid size-9 place-items-center text-slate-300" title="Tu navegador no permite grabar audio">
                  <app-icon name="mic-off" [size]="16" />
                </span>
              }
              <button type="submit" class="btn-primary size-9 p-0" [disabled]="!store.canSend()" aria-label="Enviar pregunta">
                <app-icon name="send" [size]="16" />
              </button>
            </div>
          </div>
        </form>
      }
    </footer>
  `,
})
export class TutorPanel {
  protected readonly store = inject(TutorStore);

  readonly suggestions = input<readonly string[]>([]);
  readonly closable = input(false);
  readonly closed = output<void>();

  protected readonly maxLength = MAX_QUESTION_LENGTH;
  protected readonly nearLimit = computed(() => this.store.draftLength() > MAX_QUESTION_LENGTH * 0.9);
  protected readonly pendingMessage = computed<ChatMessage | null>(() => {
    const pending = this.store.pending();
    return pending
      ? {
          id: 'pending',
          role: 'STUDENT',
          content: pending.content,
          inputMode: pending.inputMode,
          grounded: null,
          citation: null,
          createdAt: '',
        }
      : null;
  });

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  constructor() {
    // Transcripción lista: foco en el texto (para corregir o pulsar Intro) y altura ajustada al contenido.
    effect(() => {
      const element = this.textarea()?.nativeElement;
      if (element && this.store.phase() === 'reviewing') {
        queueMicrotask(() => {
          element.style.height = 'auto';
          element.style.height = `${element.scrollHeight}px`;
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
        });
      }
    });

    // Tras enviar (borrador vacío) el cuadro de texto vuelve a una línea.
    effect(() => {
      const element = this.textarea()?.nativeElement;
      if (element && this.store.draft() === '') {
        element.style.height = 'auto';
      }
    });

    // Auto-scroll al último mensaje cuando llega uno nuevo o empieza/termina un envío.
    effect(() => {
      this.store.messages();
      this.store.pending();
      const element = this.scroller()?.nativeElement;
      if (element) {
        queueMicrotask(() => element.scrollTo?.({ top: element.scrollHeight, behavior: 'smooth' }));
      }
    });
  }

  /** Barras del medidor de voz: cada una con una sensibilidad distinta para que el movimiento parezca natural. */
  protected readonly levelBars = [0.5, 0.8, 1, 0.7, 0.9, 0.6, 1, 0.75, 0.55, 0.85, 0.65, 0.95];

  protected readonly errorIcon = computed(() => {
    const error = this.store.error();
    if (error?.code === 'NETWORK_ERROR') {
      return 'wifi-off' as const;
    }
    return error?.kind === 'microphone' ? ('mic-off' as const) : ('triangle-alert' as const);
  });

  protected barHeight(sensitivity: number): number {
    return 15 + Math.min(85, this.store.recordingLevel() * 85 * sensitivity);
  }

  protected formatSeconds(total: number): string {
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  protected onErrorAction(): void {
    if (this.store.error()?.kind === 'microphone') {
      this.store.dismissError();
      this.textarea()?.nativeElement.focus();
      return;
    }
    this.store.retry();
  }

  protected ask(question: string): void {
    this.store.updateDraft(question);
    this.store.send();
  }

  protected onInput(textarea: HTMLTextAreaElement): void {
    this.store.updateDraft(textarea.value);
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  protected onEnter(event: KeyboardEvent): void {
    if (event.shiftKey || event.isComposing) {
      return;
    }
    event.preventDefault();
    this.store.send();
  }
}

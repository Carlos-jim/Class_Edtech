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
          <app-chat-message [message]="message" />
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
          [icon]="error.code === 'NETWORK_ERROR' ? 'wifi-off' : 'triangle-alert'"
          actionLabel="Reintentar"
          (action)="store.retry()"
        />
      }

      <form class="rounded-xl border border-slate-300 bg-white transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20" (submit)="$event.preventDefault(); store.send()">
        <label for="tutor-question" class="sr-only">Escribe tu pregunta</label>
        <textarea
          #textarea
          id="tutor-question"
          rows="1"
          class="block max-h-40 w-full resize-none rounded-t-xl border-0 bg-transparent px-3.5 pt-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          placeholder="Escribe tu pregunta…"
          [value]="store.draft()"
          [disabled]="store.isBusy()"
          [attr.maxlength]="maxLength"
          (input)="onInput(textarea)"
          (keydown.enter)="onEnter($any($event))"
        ></textarea>
        <div class="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
          <span class="px-1 text-[11px]" [class]="nearLimit() ? 'text-amber-600' : 'text-slate-400'">
            @if (nearLimit()) {
              {{ store.draftLength() }}/{{ maxLength }}
            } @else {
              Intro para enviar · Mayús+Intro, nueva línea
            }
          </span>
          <div class="flex items-center gap-1.5">
            <ng-content select="[composerActions]" />
            <button type="submit" class="btn-primary size-9 p-0" [disabled]="!store.canSend()" aria-label="Enviar pregunta">
              <app-icon name="send" [size]="16" />
            </button>
          </div>
        </div>
      </form>
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
      ? { id: 'pending', role: 'STUDENT', content: pending.content, inputMode: pending.inputMode, grounded: null, createdAt: '' }
      : null;
  });

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  constructor() {
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

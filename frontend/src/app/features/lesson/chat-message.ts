import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChatMessage } from '../../core/api/tutor-api';
import { MarkdownRenderer } from '../../core/markdown/markdown-renderer';
import { Icon } from '../../shared/ui/icon';

/**
 * Burbuja de chat. El contenido se muestra SIEMPRE con interpolación ({{ }}), que Angular escapa:
 * ni la pregunta del alumno ni la respuesta del modelo pueden inyectar HTML. La cita es un fragmento literal del
 * Markdown de la lección: se muestra con su formato en línea a través del mismo renderizador sanitizado.
 */
@Component({
  selector: 'app-chat-message',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block animate-fade-in' },
  template: `
    @if (isStudent()) {
      <div class="flex justify-end">
        <div class="max-w-[85%]">
          <div
            class="whitespace-pre-line rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white shadow-sm"
            [class.opacity-70]="pending()"
            data-testid="student-message"
          >{{ message().content }}</div>
          <p class="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-500">
            @if (message().inputMode === 'VOICE') {
              <app-icon name="mic" [size]="12" /> Por voz ·
            }
            {{ pending() ? 'Enviando…' : time() }}
          </p>
        </div>
      </div>
    } @else {
      <div class="flex gap-2.5">
        <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <app-icon name="sparkles" [size]="14" />
        </span>
        <div class="min-w-0 max-w-[85%]">
          <div
            class="whitespace-pre-line rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-800"
            data-testid="tutor-message"
          >{{ message().content }}</div>
          @if (message().grounded && message().citation) {
            <blockquote
              class="mt-2 border-l-2 border-emerald-300 bg-emerald-50/60 px-3 py-2 text-xs leading-relaxed text-slate-600"
              data-testid="tutor-citation"
            >
              <span class="font-medium text-emerald-800">De la lección: </span><span [innerHTML]="citationHtml()"></span>
            </blockquote>
          }
          <div class="mt-1.5 flex flex-wrap items-center gap-2">
            @if (message().grounded) {
              <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                <app-icon name="circle-check" [size]="12" /> Basado en la lección
              </span>
            } @else {
              <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                <app-icon name="circle-help" [size]="12" /> Sin información suficiente en la lección
              </span>
            }
            <span class="text-[11px] text-slate-500">{{ time() }}</span>
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
})
export class ChatMessageView {
  readonly message = input.required<ChatMessage>();
  readonly pending = input(false);

  private readonly markdown = inject(MarkdownRenderer);

  protected readonly citationHtml = computed(() => this.markdown.renderInline(this.message().citation ?? ''));
  protected readonly isStudent = computed(() => this.message().role === 'STUDENT');
  protected readonly time = computed(() => {
    const date = new Date(this.message().createdAt);
    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  });
}

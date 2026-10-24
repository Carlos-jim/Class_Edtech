import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LessonDetail } from '../../core/api/catalog-api';
import { MarkdownRenderer } from '../../core/markdown/markdown-renderer';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-lesson-content',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="mx-auto max-w-3xl animate-fade-in">
      <div class="flex items-center gap-3">
        <button type="button" class="btn-secondary px-2.5 py-1.5 xl:hidden" (click)="openSyllabus.emit()">
          <app-icon name="menu" [size]="16" /> Temario
        </button>
        <nav aria-label="Ruta de navegación" class="min-w-0 text-sm text-slate-500">
          <ol class="flex items-center gap-1.5">
            <li class="truncate"><a routerLink="/courses" class="hover:text-slate-800">{{ lesson().courseTitle }}</a></li>
            <li aria-hidden="true"><app-icon name="chevron-right" [size]="14" /></li>
            <li class="truncate font-medium text-slate-700" aria-current="page">Lección {{ lesson().position }}</li>
          </ol>
        </nav>
      </div>

      <header class="mt-6 border-b border-slate-200 pb-6">
        <h1 class="text-3xl font-semibold tracking-tight text-slate-900">{{ lesson().title }}</h1>
        <p class="mt-2 text-base text-slate-500">{{ lesson().summary }}</p>
        <p class="mt-4 flex items-center gap-1.5 text-sm text-slate-500">
          <app-icon name="clock" [size]="16" /> {{ lesson().estimatedMinutes }} min de lectura
        </p>
      </header>

      <div
        class="prose prose-slate mt-8 max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-a:text-brand-600 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.85em] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-table:text-sm"
        data-testid="lesson-body"
        [innerHTML]="html()"
      ></div>

      <nav class="mt-12 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2" aria-label="Lecciones">
        @if (lesson().previousLessonId; as previous) {
          <a [routerLink]="['/lessons', previous]" class="card flex items-center gap-3 px-4 py-3 text-sm hover:border-brand-500">
            <app-icon name="chevron-left" [size]="18" class="text-slate-400" />
            <span><span class="block text-xs text-slate-500">Anterior</span><span class="font-medium text-slate-800">Lección {{ lesson().position - 1 }}</span></span>
          </a>
        } @else {
          <span></span>
        }
        @if (lesson().nextLessonId; as next) {
          <a [routerLink]="['/lessons', next]" class="card flex items-center justify-end gap-3 px-4 py-3 text-right text-sm hover:border-brand-500">
            <span><span class="block text-xs text-slate-500">Siguiente</span><span class="font-medium text-slate-800">Lección {{ lesson().position + 1 }}</span></span>
            <app-icon name="chevron-right" [size]="18" class="text-slate-400" />
          </a>
        }
      </nav>
    </article>
  `,
})
export class LessonContent {
  private readonly markdown = inject(MarkdownRenderer);

  readonly lesson = input.required<LessonDetail>();
  readonly openSyllabus = output<void>();

  protected readonly html = computed(() => this.markdown.render(this.lesson().content));
}

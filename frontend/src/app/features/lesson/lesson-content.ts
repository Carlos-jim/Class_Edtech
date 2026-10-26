import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LessonDetail } from '../../core/api/catalog-api';
import { MarkdownRenderer } from '../../core/markdown/markdown-renderer';
import { CourseArt, artVariantFor } from '../../shared/ui/course-art';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-lesson-content',
  imports: [RouterLink, Icon, CourseArt],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="mx-auto max-w-3xl animate-fade-in">
      <nav aria-label="Ruta de navegación" class="min-w-0 text-sm text-slate-600">
        <ol class="flex items-center gap-1.5">
          <li class="truncate"><a routerLink="/courses" class="hover:text-slate-800">{{ lesson().courseTitle }}</a></li>
          <li aria-hidden="true"><app-icon name="chevron-right" [size]="14" /></li>
          <li class="truncate font-semibold text-slate-700" aria-current="page">Lección {{ lesson().position }}</li>
        </ol>
      </nav>

      <header class="card mt-4 flex items-center gap-5 p-3 pr-6">
        <app-course-art class="hidden h-28 w-36 shrink-0 rounded-2xl sm:block" [variant]="variant()" />
        <div class="min-w-0 px-3 py-2 sm:px-0">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">{{ lesson().title }}</h1>
          <p class="mt-1.5 text-sm leading-relaxed text-slate-500">{{ lesson().summary }}</p>
          <ul class="mt-3 flex flex-wrap gap-2">
            <li class="chip"><app-icon name="clock" [size]="12" /> {{ lesson().estimatedMinutes }} min de lectura</li>
            <li class="chip"><app-icon name="book-open" [size]="12" /> Lección {{ lesson().position }}</li>
          </ul>
        </div>
      </header>

      <div class="card mt-6 px-6 py-8 sm:px-10">
        <div
          class="prose prose-slate max-w-none prose-headings:scroll-mt-20 prose-headings:font-bold prose-a:text-brand-700 prose-code:rounded prose-code:bg-brand-50 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.85em] prose-code:font-normal prose-code:text-slate-800 prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-2xl prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-table:text-sm"
          data-testid="lesson-body"
          [innerHTML]="html()"
        ></div>
      </div>

      <nav class="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Lecciones">
        @if (lesson().previousLessonId; as previous) {
          <a [routerLink]="['/lessons', previous]" class="card flex items-center gap-3 px-5 py-4 text-sm transition-shadow hover:shadow-float">
            <span class="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-600">
              <app-icon name="chevron-left" [size]="18" />
            </span>
            <span><span class="block text-xs text-slate-500">Anterior</span><span class="font-semibold text-slate-800">Lección {{ lesson().position - 1 }}</span></span>
          </a>
        } @else {
          <span></span>
        }
        @if (lesson().nextLessonId; as next) {
          <a [routerLink]="['/lessons', next]" class="card flex items-center justify-end gap-3 px-5 py-4 text-right text-sm transition-shadow hover:shadow-float">
            <span><span class="block text-xs text-slate-500">Siguiente</span><span class="font-semibold text-slate-800">Lección {{ lesson().position + 1 }}</span></span>
            <span class="grid size-9 place-items-center rounded-full bg-brand-400 text-slate-900">
              <app-icon name="chevron-right" [size]="18" />
            </span>
          </a>
        }
      </nav>
    </article>
  `,
})
export class LessonContent {
  private readonly markdown = inject(MarkdownRenderer);

  readonly lesson = input.required<LessonDetail>();

  protected readonly html = computed(() => this.markdown.render(this.lesson().content));
  /** Misma ilustración que la tarjeta del curso, con la variante de la lección. */
  protected readonly variant = computed(() => artVariantFor(this.lesson().position - 1));
}

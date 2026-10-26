import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CourseSummary } from '../../core/api/catalog-api';
import { CourseArt, CourseArtVariant } from '../../shared/ui/course-art';
import { Icon } from '../../shared/ui/icon';

/** Tarjeta horizontal de curso (referencia "acourses"): ilustración pastel, datos, etiquetas y acción en píldora. */
@Component({
  selector: 'app-course-card',
  imports: [RouterLink, CourseArt, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <article class="card group flex flex-col gap-5 p-3 transition-shadow hover:shadow-float sm:flex-row">
      <app-course-art class="h-40 w-full shrink-0 rounded-2xl sm:h-auto sm:min-h-40 sm:w-48" [variant]="variant()" />

      <div class="flex min-w-0 flex-1 flex-col px-2 pb-2 sm:px-0 sm:py-2 sm:pr-3">
        <div class="flex items-start justify-between gap-3">
          <h2 class="text-lg font-bold leading-snug text-slate-900">{{ course().title }}</h2>
          <span class="mt-1 flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700">
            <app-icon name="clock" [size]="14" class="text-brand-500" />
            {{ course().totalMinutes }} min
          </span>
        </div>
        <p class="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">{{ course().description }}</p>

        <ul class="mt-3 flex flex-wrap gap-2" aria-label="Características">
          <li class="chip">
            <app-icon name="book-open" [size]="12" />
            {{ course().lessonCount }} {{ course().lessonCount === 1 ? 'lección' : 'lecciones' }}
          </li>
          <li class="chip"><app-icon name="sparkles" [size]="12" /> Tutor IA</li>
          <li class="chip"><app-icon name="mic" [size]="12" /> Texto y voz</li>
        </ul>

        <div class="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          <p class="text-xs text-slate-500">Empieza por la <span class="font-semibold text-slate-800">lección 1</span></p>
          @if (course().firstLessonId; as lessonId) {
            <a [routerLink]="['/lessons', lessonId]" class="btn-primary px-5 py-2 text-xs" [attr.aria-label]="'Empezar curso: ' + course().title">
              Empezar curso
              <app-icon name="arrow-right" [size]="14" class="transition-transform group-hover:translate-x-0.5" />
            </a>
          } @else {
            <p class="text-sm text-slate-500">Este curso aún no tiene lecciones.</p>
          }
        </div>
      </div>
    </article>
  `,
})
export class CourseCard {
  readonly course = input.required<CourseSummary>();
  readonly variant = input<CourseArtVariant>('yellow');
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CourseSummary } from '../../core/api/catalog-api';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-course-card',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <article class="card group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div class="relative h-32 overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500">
        <div class="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]"></div>
        <span class="absolute bottom-4 left-5 grid size-12 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur">
          <app-icon name="book-open" [size]="24" />
        </span>
        <span class="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-indigo-700">Curso</span>
      </div>

      <div class="flex flex-1 flex-col p-5">
        <h2 class="text-base font-semibold text-slate-900">{{ course().title }}</h2>
        <p class="mt-1.5 line-clamp-2 text-sm text-slate-500">{{ course().description }}</p>

        <dl class="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <div class="flex items-center gap-1.5">
            <app-icon name="book-open" [size]="14" />
            <dt class="sr-only">Lecciones</dt>
            <dd>{{ course().lessonCount }} {{ course().lessonCount === 1 ? 'lección' : 'lecciones' }}</dd>
          </div>
          <div class="flex items-center gap-1.5">
            <app-icon name="clock" [size]="14" />
            <dt class="sr-only">Duración</dt>
            <dd>{{ course().totalMinutes }} min</dd>
          </div>
        </dl>

        <div class="mt-5 border-t border-slate-100 pt-4">
          @if (course().firstLessonId; as lessonId) {
            <a [routerLink]="['/lessons', lessonId]" class="btn-primary w-full" [attr.aria-label]="'Empezar curso: ' + course().title">
              Empezar curso
              <app-icon name="arrow-right" [size]="16" class="transition-transform group-hover:translate-x-0.5" />
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
}

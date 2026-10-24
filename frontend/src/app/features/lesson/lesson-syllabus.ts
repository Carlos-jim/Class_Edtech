import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CourseDetail } from '../../core/api/catalog-api';
import { Icon } from '../../shared/ui/icon';

/** Temario del curso (patrón Coursera): lecciones numeradas, la activa resaltada. */
@Component({
  selector: 'app-lesson-syllabus',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="p-5" aria-label="Temario del curso">
      <a routerLink="/courses" class="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <app-icon name="chevron-left" [size]="14" /> Mis cursos
      </a>
      <p class="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Curso</p>
      <h2 class="mt-1 text-sm font-semibold leading-snug text-slate-900">{{ course().title }}</h2>

      <ol class="mt-5 space-y-1">
        @for (lesson of course().lessons; track lesson.id) {
          @let active = lesson.id === activeLessonId();
          <li>
            <a
              [routerLink]="['/lessons', lesson.id]"
              (click)="navigated.emit()"
              class="flex gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors"
              [class]="
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              "
              [attr.aria-current]="active ? 'page' : null"
            >
              <span
                class="grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold"
                [class]="active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'"
                >{{ lesson.position }}</span
              >
              <span class="min-w-0">
                <span class="block font-medium leading-snug">{{ lesson.title }}</span>
                <span class="mt-0.5 flex items-center gap-1 text-xs" [class]="active ? 'text-brand-700' : 'text-slate-500'">
                  <app-icon name="clock" [size]="12" /> {{ lesson.estimatedMinutes }} min
                </span>
              </span>
            </a>
          </li>
        }
      </ol>
    </nav>
  `,
})
export class LessonSyllabus {
  readonly course = input.required<CourseDetail>();
  readonly activeLessonId = input.required<string>();
  readonly navigated = output<void>();
}

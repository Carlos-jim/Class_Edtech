import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CourseDetail } from '../core/api/catalog-api';
import { Icon } from '../shared/ui/icon';

/**
 * Barra lateral (referencia "acourses"): logo arriba, navegación con indicador naranja en el elemento activo,
 * las lecciones de los cursos del alumno y "Salir" abajo.
 */
@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full w-64 shrink-0 flex-col bg-white px-6 pb-8 pt-10' },
  template: `
    <a routerLink="/courses" class="flex flex-col items-center gap-1.5 text-center" (click)="navigated.emit()">
      <span class="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
        <app-icon name="graduation-cap" [size]="28" [strokeWidth]="2.25" />
      </span>
      <span class="text-[15px] font-bold tracking-tight text-slate-800">edtech<span class="text-brand-700">tutor</span></span>
    </a>

    <nav aria-label="Principal" class="-mx-6 mt-12 min-h-0 flex-1 overflow-y-auto px-6">
      <a
        routerLink="/courses"
        routerLinkActive
        #coursesLink="routerLinkActive"
        [routerLinkActiveOptions]="{ exact: true }"
        [attr.aria-current]="coursesLink.isActive ? 'page' : null"
        class="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
        [class]="coursesLink.isActive ? 'font-semibold text-slate-900' : 'font-medium text-slate-500 hover:text-slate-900'"
        (click)="navigated.emit()"
      >
        @if (coursesLink.isActive) {
          <span class="absolute -left-6 top-1/2 h-1 w-4 -translate-y-1/2 rounded-r-full bg-brand-500" aria-hidden="true"></span>
        }
        <app-icon name="book-open" [size]="18" [class]="coursesLink.isActive ? 'text-brand-500' : ''" />
        Mis cursos
      </a>

      @for (course of courses(); track course.id) {
        <p class="mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{{ course.title }}</p>
        <ul class="mt-2 space-y-0.5">
          @for (lesson of course.lessons; track lesson.id) {
            <li>
              <a
                [routerLink]="['/lessons', lesson.id]"
                routerLinkActive
                #lessonLink="routerLinkActive"
                [attr.aria-current]="lessonLink.isActive ? 'page' : null"
                class="relative flex items-start gap-3 rounded-xl px-3 py-2 text-sm transition-colors"
                [class]="lessonLink.isActive ? 'bg-brand-50 font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-900'"
                (click)="navigated.emit()"
              >
                @if (lessonLink.isActive) {
                  <span class="absolute -left-6 top-1/2 h-1 w-4 -translate-y-1/2 rounded-r-full bg-brand-500" aria-hidden="true"></span>
                }
                <span
                  class="mt-px grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-bold"
                  [class]="lessonLink.isActive ? 'bg-brand-400 text-slate-900' : 'bg-slate-100 text-slate-500'"
                  >{{ lesson.position }}</span
                >
                <span class="leading-snug">{{ lesson.title }}</span>
              </a>
            </li>
          }
        </ul>
      }
    </nav>

    <button
      type="button"
      class="mt-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      (click)="logout.emit()"
    >
      <app-icon name="log-out" [size]="18" />
      Salir
    </button>
  `,
})
export class SidebarNav {
  readonly courses = input<readonly CourseDetail[]>([]);
  readonly navigated = output<void>();
  readonly logout = output<void>();
}

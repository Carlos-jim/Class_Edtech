import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { CatalogApi, CourseDetail, CourseSummary } from '../../core/api/catalog-api';
import { AuthService } from '../../core/auth/auth.service';
import { AlertBanner } from '../../shared/ui/alert-banner';
import { artVariantFor } from '../../shared/ui/course-art';
import { Icon } from '../../shared/ui/icon';
import { CourseCard } from './course-card';

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly courses: readonly CourseSummary[] }
  | { readonly status: 'error'; readonly error: ApiError };

/**
 * "Mis cursos" (referencia "acourses"): a la izquierda, buscador y tarjetas horizontales; a la derecha, el tutor IA
 * y el temario del curso como la columna "Schedule" (datos reales, sin calendarios ni valoraciones inventadas).
 */
@Component({
  selector: 'app-courses-page',
  imports: [CourseCard, AlertBanner, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="px-4 pb-12 pt-2 sm:px-8 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-12">
      <section aria-labelledby="courses-title">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 id="courses-title" class="text-3xl font-bold tracking-tight text-slate-900">Mis cursos</h1>
            <p class="mt-1 text-sm text-slate-600">
              <span class="xl:hidden">Hola, {{ firstName() }}. </span>Elige un curso y pregunta a tu tutor cuando lo necesites.
            </p>
          </div>
          @if (allCourses().length > 1) {
            <label class="relative w-full sm:w-64">
              <span class="sr-only">Buscar curso</span>
              <app-icon name="search" [size]="16" class="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                class="w-full border-b border-slate-200 bg-transparent py-2 pl-7 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
                placeholder="Buscar curso…"
                [value]="query()"
                (input)="query.set($any($event.target).value)"
              />
            </label>
          }
        </div>

        <div class="mt-8" aria-live="polite" [attr.aria-busy]="state().status === 'loading'">
          @switch (state().status) {
            @case ('loading') {
              <div class="space-y-5" data-testid="courses-loading">
                @for (placeholder of [1, 2]; track placeholder) {
                  <div class="card flex gap-5 p-3">
                    <div class="skeleton h-40 w-48 shrink-0 rounded-2xl"></div>
                    <div class="flex-1 space-y-3 py-3 pr-3">
                      <div class="skeleton h-5 w-1/2"></div>
                      <div class="skeleton h-3 w-full"></div>
                      <div class="skeleton h-3 w-4/5"></div>
                      <div class="skeleton mt-8 ml-auto h-9 w-32 rounded-full"></div>
                    </div>
                  </div>
                }
              </div>
            }
            @case ('error') {
              <app-alert-banner
                title="No se pudieron cargar tus cursos"
                [message]="errorMessage()"
                actionLabel="Reintentar"
                (action)="load()"
              />
            }
            @case ('ready') {
              @if (allCourses().length === 0) {
                <div class="card flex flex-col items-center px-6 py-16 text-center" data-testid="courses-empty">
                  <span class="grid size-16 place-items-center rounded-3xl bg-brand-50 text-brand-500">
                    <app-icon name="book-open" [size]="30" />
                  </span>
                  <h2 class="mt-5 text-lg font-bold text-slate-900">Aún no tienes cursos asignados</h2>
                  <p class="mt-1 max-w-sm text-sm text-slate-500">
                    Cuando tu centro te matricule en un curso aparecerá aquí. Si crees que es un error, contacta con tu
                    administrador.
                  </p>
                </div>
              } @else if (courses().length === 0) {
                <p class="card px-6 py-10 text-center text-sm text-slate-500">Ningún curso coincide con «{{ query() }}».</p>
              } @else {
                <div class="space-y-5">
                  @for (course of courses(); track course.id; let index = $index) {
                    <app-course-card class="animate-fade-in" [course]="course" [variant]="variantFor(index)" />
                  }
                </div>
              }
            }
          }
        </div>
      </section>

      @if (allCourses().length > 0) {
        <aside class="mt-12 space-y-10 xl:mt-0" aria-label="Tu aprendizaje">
          <section class="rounded-3xl bg-brand-100 p-6" aria-labelledby="tutor-title">
            <div class="flex items-center gap-3">
              <span class="grid size-11 place-items-center rounded-2xl bg-white text-brand-500 shadow-soft">
                <app-icon name="sparkles" [size]="20" />
              </span>
              <h2 id="tutor-title" class="text-base font-bold text-slate-900">Tu tutor IA</h2>
            </div>
            <p class="mt-3 text-sm leading-relaxed text-slate-700">
              Pregunta por escrito o en voz alta dentro de cada lección. Responde solo con el contenido del curso y te
              avisa si algo no está en él.
            </p>
            <ul class="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
              <li class="flex items-center gap-1 rounded-lg bg-white/70 px-2.5 py-1"><app-icon name="mic" [size]="12" /> Voz</li>
              <li class="flex items-center gap-1 rounded-lg bg-white/70 px-2.5 py-1"><app-icon name="volume-2" [size]="12" /> Escucha</li>
              <li class="flex items-center gap-1 rounded-lg bg-white/70 px-2.5 py-1"><app-icon name="refresh-cw" [size]="12" /> Historial</li>
            </ul>
          </section>

          @if (syllabus(); as course) {
            <section aria-labelledby="syllabus-title" data-testid="courses-syllabus">
              <div class="flex items-center justify-between">
                <h2 id="syllabus-title" class="text-lg font-bold text-slate-900">Temario</h2>
                <span class="text-sm font-medium text-slate-600">{{ course.lessons.length }} lecciones</span>
              </div>
              <p class="mt-0.5 text-xs text-slate-600">{{ course.title }}</p>
              <ol class="mt-4 space-y-2">
                @for (lesson of course.lessons; track lesson.id; let first = $first) {
                  <li>
                    <a
                      [routerLink]="['/lessons', lesson.id]"
                      class="flex items-center gap-4 rounded-2xl px-4 py-4 transition-colors"
                      [class]="first ? 'bg-white shadow-soft' : 'hover:bg-white'"
                    >
                      <span class="w-8 text-xl font-semibold tabular-nums text-slate-800">{{ pad(lesson.position) }}</span>
                      <span class="h-10 w-px bg-slate-200" aria-hidden="true"></span>
                      <span class="min-w-0 flex-1">
                        <span class="block font-semibold leading-snug text-slate-900">{{ lesson.title }}</span>
                        <span class="text-xs text-slate-600">Lección {{ lesson.position }} de {{ course.lessons.length }}</span>
                      </span>
                      <span class="whitespace-nowrap text-xs font-medium text-slate-600">{{ lesson.estimatedMinutes }} min</span>
                    </a>
                  </li>
                }
              </ol>
            </section>
          }
        </aside>
      }
    </main>
  `,
})
export class CoursesPage {
  private readonly catalog = inject(CatalogApi);
  private readonly auth = inject(AuthService);

  protected readonly state = signal<ViewState>({ status: 'loading' });
  protected readonly query = signal('');
  /** Temario del primer curso (columna derecha). */
  protected readonly syllabus = signal<CourseDetail | null>(null);

  protected readonly allCourses = computed(() => {
    const current = this.state();
    return current.status === 'ready' ? current.courses : [];
  });
  protected readonly courses = computed(() => {
    const term = normalize(this.query().trim());
    return term
      ? this.allCourses().filter((course) => normalize(`${course.title} ${course.description}`).includes(term))
      : this.allCourses();
  });
  protected readonly errorMessage = computed(() => {
    const current = this.state();
    return current.status === 'error' ? current.error.detail : '';
  });
  protected readonly firstName = computed(() => this.auth.student()?.displayName.split(' ')[0] ?? '');
  protected readonly variantFor = artVariantFor;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set({ status: 'loading' });
    this.catalog.myCourses().subscribe({
      next: (courses) => {
        this.state.set({ status: 'ready', courses });
        if (courses.length > 0) {
          this.catalog
            .course(courses[0]!.id)
            .pipe(catchError(() => of(null))) // el temario es complementario: si falla, no se muestra
            .subscribe((course) => this.syllabus.set(course));
        }
      },
      error: (error: unknown) => this.state.set({ status: 'error', error: toApiError(error) }),
    });
  }

  protected pad(position: number): string {
    return String(position).padStart(2, '0');
  }
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

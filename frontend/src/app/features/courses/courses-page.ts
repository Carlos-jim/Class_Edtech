import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiError, toApiError } from '../../core/api/api-error';
import { CatalogApi, CourseSummary } from '../../core/api/catalog-api';
import { AuthService } from '../../core/auth/auth.service';
import { AlertBanner } from '../../shared/ui/alert-banner';
import { Icon } from '../../shared/ui/icon';
import { CourseCard } from './course-card';

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly courses: readonly CourseSummary[] }
  | { readonly status: 'error'; readonly error: ApiError };

@Component({
  selector: 'app-courses-page',
  imports: [CourseCard, AlertBanner, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header>
        <p class="text-sm font-medium text-brand-600">Mis cursos</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Hola, {{ firstName() }}</h1>
        <p class="mt-1 text-sm text-slate-500">Continúa aprendiendo y pregunta a tu tutor cuando lo necesites.</p>
      </header>

      <section class="mt-8" aria-live="polite" [attr.aria-busy]="state().status === 'loading'">
        @switch (state().status) {
          @case ('loading') {
            <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="courses-loading">
              @for (placeholder of [1, 2]; track placeholder) {
                <div class="card overflow-hidden">
                  <div class="skeleton h-32 rounded-none"></div>
                  <div class="space-y-3 p-5">
                    <div class="skeleton h-4 w-2/3"></div>
                    <div class="skeleton h-3 w-full"></div>
                    <div class="skeleton h-3 w-5/6"></div>
                    <div class="skeleton mt-6 h-10 w-full"></div>
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
            @if (courses().length > 0) {
              <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                @for (course of courses(); track course.id) {
                  <app-course-card class="animate-fade-in" [course]="course" />
                }
              </div>
            } @else {
              <div class="card flex flex-col items-center px-6 py-16 text-center" data-testid="courses-empty">
                <span class="grid size-14 place-items-center rounded-full bg-slate-100 text-slate-400">
                  <app-icon name="book-open" [size]="28" />
                </span>
                <h2 class="mt-4 text-base font-semibold text-slate-900">Aún no tienes cursos asignados</h2>
                <p class="mt-1 max-w-sm text-sm text-slate-500">
                  Cuando tu centro te matricule en un curso aparecerá aquí. Si crees que es un error, contacta con tu
                  administrador.
                </p>
              </div>
            }
          }
        }
      </section>
    </main>
  `,
})
export class CoursesPage {
  private readonly catalog = inject(CatalogApi);
  private readonly auth = inject(AuthService);

  protected readonly state = signal<ViewState>({ status: 'loading' });
  protected readonly courses = computed(() => {
    const current = this.state();
    return current.status === 'ready' ? current.courses : [];
  });
  protected readonly errorMessage = computed(() => {
    const current = this.state();
    return current.status === 'error' ? current.error.detail : '';
  });
  protected readonly firstName = computed(() => this.auth.student()?.displayName.split(' ')[0] ?? '');

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set({ status: 'loading' });
    this.catalog.myCourses().subscribe({
      next: (courses) => this.state.set({ status: 'ready', courses }),
      error: (error: unknown) => this.state.set({ status: 'error', error: toApiError(error) }),
    });
  }
}

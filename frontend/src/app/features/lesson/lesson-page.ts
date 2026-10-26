import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { CatalogApi, LessonDetail } from '../../core/api/catalog-api';
import { MarkdownRenderer } from '../../core/markdown/markdown-renderer';
import { AlertBanner } from '../../shared/ui/alert-banner';
import { Icon } from '../../shared/ui/icon';
import { mediaQuery } from '../../shared/ui/media-query';
import { LessonContent } from './lesson-content';
import { suggestQuestions } from './suggestions';
import { TutorPanel } from './tutor-panel';
import { TutorStore } from './tutor-store';

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly lesson: LessonDetail }
  | { readonly status: 'denied' }
  | { readonly status: 'error'; readonly error: ApiError };

/**
 * Pantalla de lección (referencia "acourses"): contenido a la izquierda y tutor a la derecha, como la columna
 * "Schedule". El temario vive en la barra lateral del shell. <1024 px: tutor a pantalla completa.
 */
@Component({
  selector: 'app-lesson-page',
  imports: [RouterLink, Icon, AlertBanner, LessonContent, TutorPanel],
  providers: [TutorStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state().status) {
      @case ('loading') {
        <div class="mx-auto max-w-3xl px-6 py-10" data-testid="lesson-loading" aria-busy="true">
          <div class="skeleton h-4 w-48"></div>
          <div class="skeleton mt-6 h-9 w-3/4"></div>
          <div class="skeleton mt-3 h-4 w-2/3"></div>
          <div class="mt-10 space-y-3">
            @for (line of [1, 2, 3, 4, 5, 6]; track line) {
              <div class="skeleton h-3.5" [style.width.%]="100 - line * 6"></div>
            }
          </div>
        </div>
      }

      @case ('denied') {
        <main class="mx-auto max-w-lg px-6 py-20 text-center" data-testid="lesson-denied">
          <span class="mx-auto grid size-14 place-items-center rounded-full bg-slate-100 text-slate-500">
            <app-icon name="lock" [size]="26" />
          </span>
          <h1 class="mt-5 text-xl font-semibold text-slate-900">No tienes acceso a esta lección</h1>
          <p class="mt-2 text-sm text-slate-500">
            Puede que no estés matriculado en el curso o que la lección ya no exista.
          </p>
          <a routerLink="/courses" class="btn-primary mt-8">
            <app-icon name="chevron-left" [size]="16" /> Volver a mis cursos
          </a>
        </main>
      }

      @case ('error') {
        <main class="mx-auto max-w-xl px-6 py-16">
          <app-alert-banner
            title="No se pudo cargar la lección"
            [message]="errorMessage()"
            actionLabel="Reintentar"
            (action)="reload()"
          />
        </main>
      }

      @case ('ready') {
        @if (ready(); as view) {
          <div class="lg:grid lg:h-full lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:px-8 lg:pb-8 xl:grid-cols-[minmax(0,1fr)_400px]">
            <main class="min-w-0 px-4 pb-24 sm:px-8 lg:overflow-y-auto lg:px-0 lg:pb-4" data-testid="lesson-scroll">
              <app-lesson-content [lesson]="view.lesson" />
            </main>

            <!-- Tutor junto al contenido (≥1024), como la columna derecha de la referencia -->
            @if (isLg()) {
              <aside class="card min-h-0 overflow-hidden" aria-label="Tutor IA">
                <app-tutor-panel [suggestions]="suggestions()" />
              </aside>
            }
          </div>

          <!-- Tutor a pantalla completa (<1024) -->
          @if (!isLg()) {
            @if (tutorOpen()) {
              <div class="fixed inset-0 z-50 flex flex-col bg-white animate-fade-in" role="dialog" aria-modal="true" aria-label="Tutor IA">
                <app-tutor-panel class="flex-1" [suggestions]="suggestions()" [closable]="true" (closed)="tutorOpen.set(false)" />
              </div>
            } @else {
              <button type="button" class="btn-primary fixed bottom-5 right-5 z-30 px-5 py-3 shadow-float" (click)="tutorOpen.set(true)">
                <app-icon name="sparkles" [size]="18" /> Preguntar al tutor
              </button>
            }
          }
        }
      }
    }
  `,
})
export class LessonPage {
  private readonly catalog = inject(CatalogApi);
  private readonly markdown = inject(MarkdownRenderer);
  private readonly title = inject(Title);
  private readonly tutor = inject(TutorStore);

  /** Parámetro de ruta (withComponentInputBinding). */
  readonly lessonId = input.required<string>();

  protected readonly state = signal<ViewState>({ status: 'loading' });
  protected readonly tutorOpen = signal(false);
  protected readonly isLg = mediaQuery('(min-width: 1024px)');

  protected readonly ready = computed(() => {
    const current = this.state();
    return current.status === 'ready' ? current : null;
  });
  protected readonly errorMessage = computed(() => {
    const current = this.state();
    return current.status === 'error' ? current.error.detail : '';
  });
  protected readonly suggestions = computed(() => {
    const view = this.ready();
    return view ? suggestQuestions(this.markdown.headings(view.lesson.content)) : [];
  });

  private readonly reloads = signal(0);

  constructor() {
    toObservable(computed(() => ({ id: this.lessonId(), attempt: this.reloads() })))
      .pipe(
        switchMap(({ id }) => {
          this.state.set({ status: 'loading' });
          return this.catalog.lesson(id).pipe(
            map((lesson): ViewState => ({ status: 'ready', lesson })),
            catchError((error: unknown) => {
              const apiError = toApiError(error);
              return of<ViewState>(apiError.status === 404 ? { status: 'denied' } : { status: 'error', error: apiError });
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        this.state.set(state);
        if (state.status === 'ready') {
          this.title.setTitle(`${state.lesson.title} · EdTech Tutor`);
          this.tutor.load(state.lesson.id);
        }
      });
  }

  protected reload(): void {
    this.reloads.update((count) => count + 1);
  }
}

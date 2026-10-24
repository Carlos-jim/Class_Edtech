import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { CatalogApi, CourseDetail, LessonDetail } from '../../core/api/catalog-api';
import { MarkdownRenderer } from '../../core/markdown/markdown-renderer';
import { AlertBanner } from '../../shared/ui/alert-banner';
import { Icon } from '../../shared/ui/icon';
import { mediaQuery } from '../../shared/ui/media-query';
import { LessonContent } from './lesson-content';
import { LessonSyllabus } from './lesson-syllabus';
import { suggestQuestions } from './suggestions';
import { TutorPanel } from './tutor-panel';
import { TutorStore } from './tutor-store';

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly lesson: LessonDetail; readonly course: CourseDetail }
  | { readonly status: 'denied' }
  | { readonly status: 'error'; readonly error: ApiError };

/**
 * Pantalla de lección: temario (Coursera) + contenido + tutor al lado (Khanmigo).
 * ≥1280 px: tres columnas · ≥1024 px: temario en panel lateral · <1024 px: tutor a pantalla completa.
 */
@Component({
  selector: 'app-lesson-page',
  imports: [RouterLink, Icon, AlertBanner, LessonContent, LessonSyllabus, TutorPanel],
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
          <div class="mx-auto max-w-[90rem] lg:grid lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[280px_minmax(0,1fr)_400px]">
            <!-- Temario fijo (≥1280) -->
            @if (isXl()) {
              <aside class="sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto border-r border-slate-200 bg-white">
                <app-lesson-syllabus [course]="view.course" [activeLessonId]="view.lesson.id" />
              </aside>
            }

            <main class="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
              <app-lesson-content [lesson]="view.lesson" (openSyllabus)="syllabusOpen.set(true)" />
            </main>

            <!-- Tutor junto al contenido (≥1024) -->
            @if (isLg()) {
              <aside class="sticky top-14 h-[calc(100dvh-3.5rem)] border-l border-slate-200" aria-label="Tutor IA">
                <app-tutor-panel [suggestions]="suggestions()" />
              </aside>
            }
          </div>

          <!-- Temario como panel lateral (<1280) -->
          @if (!isXl() && syllabusOpen()) {
            <div class="fixed inset-0 z-40 bg-slate-900/40 animate-fade-in" (click)="syllabusOpen.set(false)" aria-hidden="true"></div>
            <aside class="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] overflow-y-auto bg-white shadow-xl animate-fade-in" aria-label="Temario">
              <div class="flex justify-end p-2">
                <button type="button" class="btn-ghost p-1.5" aria-label="Cerrar temario" (click)="syllabusOpen.set(false)">
                  <app-icon name="x" [size]="18" />
                </button>
              </div>
              <app-lesson-syllabus [course]="view.course" [activeLessonId]="view.lesson.id" (navigated)="syllabusOpen.set(false)" />
            </aside>
          }

          <!-- Tutor a pantalla completa (<1024) -->
          @if (!isLg()) {
            @if (tutorOpen()) {
              <div class="fixed inset-0 z-50 flex flex-col bg-white animate-fade-in" role="dialog" aria-modal="true" aria-label="Tutor IA">
                <app-tutor-panel class="flex-1" [suggestions]="suggestions()" [closable]="true" (closed)="tutorOpen.set(false)" />
              </div>
            } @else {
              <button
                type="button"
                class="btn-primary fixed bottom-5 right-5 z-30 rounded-full px-5 py-3 shadow-lg"
                (click)="tutorOpen.set(true)"
              >
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
  protected readonly syllabusOpen = signal(false);
  protected readonly tutorOpen = signal(false);
  protected readonly isLg = mediaQuery('(min-width: 1024px)');
  protected readonly isXl = mediaQuery('(min-width: 1280px)');

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
          this.syllabusOpen.set(false);
          return this.catalog.lesson(id).pipe(
            switchMap((lesson) => this.catalog.course(lesson.courseId).pipe(map((course) => ({ lesson, course })))),
            map(({ lesson, course }): ViewState => ({ status: 'ready', lesson, course })),
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

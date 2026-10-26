import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { catchError, filter, forkJoin, map, of, switchMap } from 'rxjs';
import { CatalogApi, CourseDetail } from '../core/api/catalog-api';
import { AuthService } from '../core/auth/auth.service';
import { Icon } from '../shared/ui/icon';
import { mediaQuery } from '../shared/ui/media-query';
import { SidebarNav } from './sidebar-nav';

/**
 * Layout de las páginas privadas (referencia "acourses"): contenedor flotante redondeado con barra lateral blanca,
 * barra superior (saludo + alumno) y contenido. Por debajo de 1280 px la barra lateral es un menú desplegable.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, Icon, SidebarNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-dvh xl:p-6">
      <div class="flex h-full overflow-hidden bg-surface xl:rounded-[2rem] xl:shadow-float">
        @if (isXl()) {
          <app-sidebar-nav class="rounded-l-[2rem]" [courses]="courses()" (logout)="logout()" />
        }

        <div class="flex min-w-0 flex-1 flex-col">
          <header class="flex h-16 shrink-0 items-center gap-3 px-4 sm:px-8 xl:h-20">
            @if (!isXl()) {
              <button type="button" class="btn-ghost -ml-2 p-2" aria-label="Abrir menú" (click)="menuOpen.set(true)">
                <app-icon name="menu" [size]="20" />
              </button>
              <a routerLink="/courses" class="flex items-center gap-2 text-[15px] font-bold tracking-tight text-slate-800">
                <span class="grid size-8 place-items-center rounded-xl bg-brand-50 text-brand-500">
                  <app-icon name="graduation-cap" [size]="18" [strokeWidth]="2.25" />
                </span>
                <span class="hidden sm:inline">edtech<span class="text-brand-700">tutor</span></span>
              </a>
            } @else {
              <p class="text-sm text-slate-600">
                Hola, <span class="font-semibold text-slate-900">{{ firstName() }}</span>. Sigue aprendiendo a tu ritmo.
              </p>
            }

            <div class="ml-auto flex items-center gap-3">
              <span
                class="grid size-10 place-items-center rounded-full bg-brand-400 text-sm font-bold text-slate-900 ring-4 ring-brand-100"
                aria-hidden="true"
                >{{ initials() }}</span
              >
              <span class="hidden text-sm font-semibold text-slate-800 sm:inline" data-testid="current-user">{{
                student()?.displayName
              }}</span>
            </div>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto" data-testid="shell-content">
            <router-outlet />
          </div>
        </div>
      </div>
    </div>

    <!-- Menú lateral en pantallas medianas y pequeñas -->
    @if (!isXl() && menuOpen()) {
      <div class="fixed inset-0 z-40 bg-slate-900/40 animate-fade-in" (click)="menuOpen.set(false)" aria-hidden="true"></div>
      <div class="fixed inset-y-0 left-0 z-50 flex animate-fade-in shadow-xl" role="dialog" aria-modal="true" aria-label="Menú">
        <app-sidebar-nav class="rounded-r-[2rem]" [courses]="courses()" (navigated)="menuOpen.set(false)" (logout)="logout()" />
        <button
          type="button"
          class="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
          aria-label="Cerrar menú"
          (click)="menuOpen.set(false)"
        >
          <app-icon name="x" [size]="18" />
        </button>
      </div>
    }
  `,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly catalog = inject(CatalogApi);

  protected readonly isXl = mediaQuery('(min-width: 1280px)');
  protected readonly menuOpen = signal(false);
  /** Cursos del alumno con sus lecciones, para la navegación lateral. Si falla, la barra sigue con "Mis cursos". */
  protected readonly courses = signal<readonly CourseDetail[]>([]);

  protected readonly student = this.auth.student;
  protected readonly firstName = computed(() => this.student()?.displayName.split(' ')[0] ?? '');
  protected readonly initials = computed(() =>
    (this.student()?.displayName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join(''),
  );

  constructor() {
    this.catalog
      .myCourses()
      .pipe(
        switchMap((summaries) =>
          summaries.length ? forkJoin(summaries.map((course) => this.catalog.course(course.id))) : of([]),
        ),
        catchError(() => of([])),
        takeUntilDestroyed(),
      )
      .subscribe((courses) => this.courses.set(courses));

    // Al navegar, el menú desplegable se cierra.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => false),
        takeUntilDestroyed(),
      )
      .subscribe((open) => this.menuOpen.set(open));
  }

  protected logout(): void {
    this.auth.logout();
  }
}

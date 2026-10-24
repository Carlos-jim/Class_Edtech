import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Icon } from '../shared/ui/icon';

/** Layout de las páginas privadas: barra superior (marca, navegación, usuario) + contenido. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-[90rem] items-center gap-6 px-4 sm:px-6">
        <a routerLink="/courses" class="flex items-center gap-2 font-semibold text-slate-900">
          <span class="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
            <app-icon name="graduation-cap" [size]="18" />
          </span>
          <span class="hidden sm:inline">EdTech Tutor</span>
        </a>

        <nav aria-label="Principal" class="flex items-center gap-1 text-sm">
          <a
            routerLink="/courses"
            routerLinkActive="bg-slate-100 text-slate-900"
            class="rounded-md px-3 py-1.5 font-medium text-slate-600 transition-colors hover:text-slate-900"
            >Mis cursos</a
          >
        </nav>

        <div class="ml-auto flex items-center gap-3">
          <div class="flex items-center gap-2.5">
            <span
              class="grid size-8 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
              aria-hidden="true"
              >{{ initials() }}</span
            >
            <span class="hidden text-sm font-medium text-slate-700 sm:inline" data-testid="current-user">{{ student()?.displayName }}</span>
          </div>
          <button type="button" class="btn-ghost px-2.5 py-1.5" (click)="logout()" aria-label="Salir" title="Cerrar sesión">
            <app-icon name="log-out" [size]="18" />
            <span class="hidden md:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>

    <router-outlet />
  `,
})
export class Shell {
  private readonly auth = inject(AuthService);

  protected readonly student = this.auth.student;
  protected readonly initials = computed(() =>
    (this.student()?.displayName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join(''),
  );

  protected logout(): void {
    this.auth.logout();
  }
}

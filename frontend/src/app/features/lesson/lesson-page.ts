import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';

/** Provisional: la pantalla de lección + tutor se implementa en el siguiente paso. */
@Component({
  selector: 'app-lesson-page',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <span class="mx-auto grid size-14 place-items-center rounded-full bg-brand-50 text-brand-600">
        <app-icon name="book-open" [size]="28" />
      </span>
      <h1 class="mt-4 text-xl font-semibold text-slate-900">Pantalla de lección en construcción</h1>
      <a routerLink="/courses" class="btn-secondary mt-6">
        <app-icon name="chevron-left" [size]="16" /> Volver a mis cursos
      </a>
    </main>
  `,
})
export class LessonPage {}

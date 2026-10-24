import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon, IconName } from './icon';

export type AlertTone = 'error' | 'warning' | 'info';

const TONES: Record<AlertTone, { box: string; icon: IconName; iconColor: string }> = {
  error: { box: 'border-red-200 bg-red-50 text-red-800', icon: 'triangle-alert', iconColor: 'text-red-600' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'triangle-alert', iconColor: 'text-amber-600' },
  info: { box: 'border-sky-200 bg-sky-50 text-sky-900', icon: 'info', iconColor: 'text-sky-600' },
};

/** Mensaje concreto + acción opcional ("Reintentar", "Escribir en su lugar"...), como en Stripe. */
@Component({
  selector: 'app-alert-banner',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm animate-fade-in"
      [class]="style().box"
      [attr.role]="tone() === 'error' ? 'alert' : 'status'"
    >
      <app-icon [name]="icon() ?? style().icon" [size]="18" class="mt-0.5" [class]="style().iconColor" />
      <div class="min-w-0 flex-1">
        @if (title()) {
          <p class="font-medium">{{ title() }}</p>
        }
        <p [class.mt-0.5]="!!title()">{{ message() }}</p>
      </div>
      @if (actionLabel()) {
        <button type="button" class="shrink-0 font-medium underline-offset-2 hover:underline" (click)="action.emit()">
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
})
export class AlertBanner {
  readonly tone = input<AlertTone>('error');
  readonly title = input<string>();
  readonly message = input.required<string>();
  readonly icon = input<IconName>();
  readonly actionLabel = input<string>();
  readonly action = output<void>();

  protected readonly style = computed(() => TONES[this.tone()]);
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type SvgNode =
  | { readonly tag: 'path'; readonly d: string }
  | { readonly tag: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly tag: 'rect'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly rx: number };

const p = (d: string): SvgNode => ({ tag: 'path', d });
const c = (cx: number, cy: number, r: number): SvgNode => ({ tag: 'circle', cx, cy, r });
const r = (x: number, y: number, w: number, h: number, rx: number): SvgNode => ({ tag: 'rect', x, y, w, h, rx });

/** Iconos de Lucide (https://lucide.dev, licencia ISC). Se dibujan con bindings, sin innerHTML. */
const ICONS = {
  'arrow-right': [p('M5 12h14'), p('m12 5 7 7-7 7')],
  'book-open': [p('M12 7v14'), p('M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z')],
  'chevron-left': [p('m15 18-6-6 6-6')],
  'chevron-right': [p('m9 18 6-6-6-6')],
  'circle-check': [c(12, 12, 10), p('m9 12 2 2 4-4')],
  'circle-help': [c(12, 12, 10), p('M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'), p('M12 17h.01')],
  clock: [c(12, 12, 10), p('M12 6v6l4 2')],
  eye: [p('M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0'), c(12, 12, 3)],
  'eye-off': [
    p('M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49'),
    p('M14.084 14.158a3 3 0 0 1-4.242-4.242'),
    p('M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143'),
    p('m2 2 20 20'),
  ],
  'graduation-cap': [
    p('M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z'),
    p('M22 10v6'),
    p('M6 12.5V16a6 3 0 0 0 12 0v-3.5'),
  ],
  info: [c(12, 12, 10), p('M12 16v-4'), p('M12 8h.01')],
  'loader-circle': [p('M21 12a9 9 0 1 1-6.219-8.56')],
  lock: [r(3, 11, 18, 11, 2), p('M7 11V7a5 5 0 0 1 10 0v4')],
  'log-out': [p('m16 17 5-5-5-5'), p('M21 12H9'), p('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4')],
  menu: [p('M4 12h16'), p('M4 18h16'), p('M4 6h16')],
  mic: [p('M12 19v3'), p('M19 10v2a7 7 0 0 1-14 0v-2'), r(9, 2, 6, 13, 3)],
  'mic-off': [
    p('M12 19v3'),
    p('M15 9.34V5a3 3 0 0 0-5.68-1.33'),
    p('M16.95 16.95A7 7 0 0 1 5 12v-2'),
    p('M18.89 13.23A7 7 0 0 0 19 12v-2'),
    p('m2 2 20 20'),
    p('M9 9v3a3 3 0 0 0 5.12 2.12'),
  ],
  pencil: [
    p('M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'),
    p('m15 5 4 4'),
  ],
  'refresh-cw': [
    p('M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'),
    p('M21 3v5h-5'),
    p('M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'),
    p('M8 16H3v5'),
  ],
  send: [
    p('M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z'),
    p('m21.854 2.147-10.94 10.939'),
  ],
  sparkles: [
    p('M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z'),
  ],
  square: [r(3, 3, 18, 18, 2)],
  'triangle-alert': [p('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'), p('M12 9v4'), p('M12 17h.01')],
  user: [p('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'), c(12, 7, 4)],
  'volume-2': [
    p('M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z'),
    p('M16 9a5 5 0 0 1 0 6'),
    p('M19.364 18.364a9 9 0 0 0 0-12.728'),
  ],
  'wifi-off': [
    p('M12 20h.01'),
    p('M8.5 16.429a5 5 0 0 1 7 0'),
    p('M5 12.859a10 10 0 0 1 5.17-2.69'),
    p('M19 12.859a10 10 0 0 0-2.007-1.523'),
    p('M2 8.82a15 15 0 0 1 4.177-2.643'),
    p('M22 8.82a15 15 0 0 0-11.288-3.764'),
    p('m2 2 20 20'),
  ],
  x: [p('M18 6 6 18'), p('m6 6 12 12')],
} satisfies Record<string, readonly SvgNode[]>;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.stroke-width]="strokeWidth()"
    >
      @for (node of nodes(); track $index) {
        @switch (node.tag) {
          @case ('path') {
            <svg:path [attr.d]="$any(node).d" />
          }
          @case ('circle') {
            <svg:circle [attr.cx]="$any(node).cx" [attr.cy]="$any(node).cy" [attr.r]="$any(node).r" />
          }
          @case ('rect') {
            <svg:rect
              [attr.x]="$any(node).x"
              [attr.y]="$any(node).y"
              [attr.width]="$any(node).w"
              [attr.height]="$any(node).h"
              [attr.rx]="$any(node).rx"
            />
          }
        }
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(2);

  protected readonly nodes = computed<readonly SvgNode[]>(() => ICONS[this.name()]);
}

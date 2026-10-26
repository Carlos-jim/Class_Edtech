import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type CourseArtVariant = 'yellow' | 'lavender' | 'pink';

const PALETTES: Record<CourseArtVariant, { bg: string; blob: string; accent: string; server: string }> = {
  yellow: { bg: '#ffd65c', blob: '#ffc533', accent: '#f59a0b', server: '#8b8ff7' },
  lavender: { bg: '#a5a8ff', blob: '#9195f5', accent: '#fdb022', server: '#ffd65c' },
  pink: { bg: '#ffb3c4', blob: '#ff9fb4', accent: '#8b8ff7', server: '#ffd65c' },
};

/**
 * Ilustración decorativa de curso (SVG propio, estilo pastel "3D" de la referencia): ventana de navegador con una
 * petición a un servidor. Es decorativa: se oculta a los lectores de pantalla.
 */
@Component({
  selector: 'app-course-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-hidden', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 200 160" class="size-full" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="160" [attr.fill]="palette().bg" />
      <circle cx="168" cy="22" r="46" [attr.fill]="palette().blob" />
      <circle cx="18" cy="150" r="38" [attr.fill]="palette().blob" />

      <!-- sombra suave -->
      <ellipse cx="96" cy="138" rx="66" ry="7" fill="#000" opacity="0.08" />

      <!-- servidor -->
      <g transform="translate(138 62)">
        <rect x="0" y="6" width="44" height="66" rx="10" fill="#000" opacity="0.08" />
        <rect x="0" y="0" width="44" height="66" rx="10" [attr.fill]="palette().server" />
        <rect x="7" y="10" width="30" height="12" rx="4" fill="#fff" opacity="0.85" />
        <rect x="7" y="27" width="30" height="12" rx="4" fill="#fff" opacity="0.85" />
        <rect x="7" y="44" width="30" height="12" rx="4" fill="#fff" opacity="0.85" />
        <circle cx="13" cy="16" r="2.4" fill="#22c55e" />
        <circle cx="13" cy="33" r="2.4" fill="#22c55e" />
        <circle cx="13" cy="50" r="2.4" [attr.fill]="palette().accent" />
      </g>

      <!-- ventana de navegador -->
      <g transform="translate(22 30)">
        <rect x="3" y="8" width="104" height="92" rx="14" fill="#000" opacity="0.08" />
        <rect x="0" y="0" width="104" height="92" rx="14" fill="#fff" />
        <rect x="0" y="0" width="104" height="20" rx="14" fill="#f1f5f9" />
        <rect x="0" y="10" width="104" height="10" fill="#f1f5f9" />
        <circle cx="12" cy="10" r="3.2" fill="#ff6b6b" />
        <circle cx="22" cy="10" r="3.2" fill="#ffd65c" />
        <circle cx="32" cy="10" r="3.2" fill="#22c55e" />
        <text x="12" y="54" font-family="ui-monospace, monospace" font-size="26" font-weight="700" [attr.fill]="palette().accent">
          {{ '{ }' }}
        </text>
        <rect x="56" y="34" width="36" height="6" rx="3" fill="#e2e8f0" />
        <rect x="56" y="46" width="28" height="6" rx="3" fill="#e2e8f0" />
        <rect x="12" y="68" width="52" height="14" rx="7" [attr.fill]="palette().accent" />
        <text x="22" y="78.5" font-family="ui-sans-serif, sans-serif" font-size="9" font-weight="800" fill="#fff">POST</text>
      </g>

      <!-- petición → servidor -->
      <path d="M126 104 C 134 104, 132 92, 140 92" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
      <path d="M136 88 L141 92 L136 96" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />

      <!-- destello -->
      <path d="M150 34 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#fff" opacity="0.9" />
    </svg>
  `,
})
export class CourseArt {
  readonly variant = input<CourseArtVariant>('yellow');

  protected readonly palette = computed(() => PALETTES[this.variant()]);
}

/** Variante estable por posición (como las tarjetas de colores alternos de la referencia). */
export function artVariantFor(index: number): CourseArtVariant {
  return (['yellow', 'lavender', 'pink'] as const)[index % 3]!;
}

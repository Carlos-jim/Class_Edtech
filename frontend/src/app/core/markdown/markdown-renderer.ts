import { Injectable } from '@angular/core';
import DOMPurify from 'dompurify';
import { Marked } from 'marked';

/**
 * Markdown → HTML seguro. Defensa en profundidad contra XSS:
 *   1. `marked` genera el HTML (sin HTML crudo del autor: se escapa).
 *   2. DOMPurify elimina cualquier script, manejador de eventos o URL peligrosa.
 *   3. Angular vuelve a sanitizar al asignarlo con [innerHTML] (no se usa bypassSecurityTrust*).
 */
@Injectable({ providedIn: 'root' })
export class MarkdownRenderer {
  private readonly marked = new Marked({
    gfm: true,
    async: false,
    renderer: {
      // El HTML incrustado en el Markdown se muestra como texto, nunca se interpreta.
      html: ({ text }) => escapeHtml(text),
    },
  });

  render(markdown: string): string {
    const html = this.marked.parse(markdown ?? '') as string;
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button', 'object', 'embed'],
      FORBID_ATTR: ['style'],
    });
  }

  /** Títulos de sección (##, ###) para sugerir preguntas al alumno. */
  headings(markdown: string): string[] {
    return [...(markdown ?? '').matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => match[1]!.trim());
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

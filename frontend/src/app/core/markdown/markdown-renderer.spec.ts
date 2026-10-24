import { TestBed } from '@angular/core/testing';
import { MarkdownRenderer } from './markdown-renderer';

describe('MarkdownRenderer', () => {
  const render = (markdown: string) => TestBed.inject(MarkdownRenderer).render(markdown);

  it('renders lesson markdown: headings, emphasis, code and tables', () => {
    const html = render('## POST — Crear\n\nSirve para **crear**.\n\n```http\nPOST /x\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |');

    expect(html).toContain('<h2>POST — Crear</h2>');
    expect(html).toContain('<strong>crear</strong>');
    expect(html).toContain('<code class="language-http">');
    expect(html).toContain('<table>');
  });

  it('escapes raw HTML written in the markdown instead of interpreting it', () => {
    const html = render('Hola <img src=x onerror="alert(1)"> <script>alert(2)</script>');

    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });

  it('removes dangerous links', () => {
    const html = render('[clic](javascript:alert(1)) y [datos](data:text/html;base64,PHNjcmlwdD4=)');

    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toMatch(/href="data:/i);
  });

  it('extracts section headings for suggestions', () => {
    expect(TestBed.inject(MarkdownRenderer).headings('# T\n## ¿Qué es REST?\ntexto\n### GET — Leer\n#### no')).toEqual([
      '¿Qué es REST?',
      'GET — Leer',
    ]);
  });
});

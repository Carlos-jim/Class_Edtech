const SKIPPED = /^(resumen|introducci[oó]n|conclusi[oó]n|errores comunes)$/i;

/**
 * Preguntas sugeridas a partir de los títulos de la lección, para que el alumno empiece rápido.
 * "¿Qué es una API?" se usa tal cual; "POST — Crear" se convierte en "Explícame: POST".
 */
export function suggestQuestions(headings: readonly string[], max = 3): string[] {
  const questions = headings
    .map((heading) => heading.split(/\s+[—–-]\s+/)[0]!.trim())
    .filter((heading) => heading.length > 0 && !SKIPPED.test(heading))
    .map((heading) => (heading.endsWith('?') ? heading : `Explícame: ${heading}`));
  return [...new Set(questions)].slice(0, max);
}

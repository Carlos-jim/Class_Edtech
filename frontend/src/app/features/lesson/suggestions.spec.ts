import { suggestQuestions } from './suggestions';

describe('suggestQuestions', () => {
  it('keeps questions as they are and turns topics into "Explícame"', () => {
    expect(suggestQuestions(['¿Qué es una API?', 'POST — Crear', 'Recursos y URIs'])).toEqual([
      '¿Qué es una API?',
      'Explícame: POST',
      'Explícame: Recursos y URIs',
    ]);
  });

  it('skips generic sections, removes duplicates and limits the count', () => {
    expect(suggestQuestions(['Resumen', 'GET — Leer', 'GET — Otra', 'PUT', 'PATCH', 'DELETE'], 3)).toEqual([
      'Explícame: GET',
      'Explícame: PUT',
      'Explícame: PATCH',
    ]);
  });
});

import { HttpErrorResponse } from '@angular/common/http';
import { NETWORK_ERROR, toApiError } from './api-error';

describe('toApiError', () => {
  it('uses the stable code and detail from a ProblemDetail body', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { code: 'VALIDATION_FAILED', detail: 'Hay campos con errores', fields: { email: 'inválido' } },
    });

    expect(toApiError(error)).toEqual({
      status: 400,
      code: 'VALIDATION_FAILED',
      detail: 'Hay campos con errores',
      fields: { email: 'inválido' },
    });
  });

  it('maps status 0 to a network error', () => {
    const apiError = toApiError(new HttpErrorResponse({ status: 0 }));

    expect(apiError.code).toBe(NETWORK_ERROR);
    expect(apiError.detail).toContain('conexión');
  });

  it('falls back to a generic message when the body is not a ProblemDetail', () => {
    const apiError = toApiError(new HttpErrorResponse({ status: 502, error: '<html>Bad gateway</html>' }));

    expect(apiError).toMatchObject({ status: 502, code: 'HTTP_502' });
    expect(apiError.detail).not.toContain('<html>');
  });

  it('returns ApiError instances untouched and wraps unknown errors', () => {
    const existing = { status: 404, code: 'NOT_FOUND', detail: 'x' };

    expect(toApiError(existing)).toBe(existing);
    expect(toApiError(new Error('boom')).code).toBe('CLIENT_ERROR');
  });
});

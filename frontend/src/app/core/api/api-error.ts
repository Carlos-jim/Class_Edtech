import { HttpErrorResponse } from '@angular/common/http';

/**
 * Error normalizado de la API. `code` es estable (lo define el backend, RFC 9457 + `code`) y la UI lo usa para
 * decidir qué mensaje y qué acción mostrar. `NETWORK_ERROR` lo genera el cliente cuando no hay respuesta.
 */
export interface ApiError {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly fields?: Readonly<Record<string, string>>;
}

export const NETWORK_ERROR = 'NETWORK_ERROR';

const FALLBACK_DETAIL = 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';
const NETWORK_DETAIL = 'No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo.';

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApiError).status === 'number' &&
    typeof (value as ApiError).code === 'string'
  );
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1, code: 'CLIENT_ERROR', detail: FALLBACK_DETAIL };
  }
  if (error.status === 0) {
    return { status: 0, code: NETWORK_ERROR, detail: NETWORK_DETAIL };
  }
  const body = error.error as Partial<{ code: string; detail: string; fields: Record<string, string> }> | null;
  return {
    status: error.status,
    code: typeof body?.code === 'string' ? body.code : `HTTP_${error.status}`,
    detail: typeof body?.detail === 'string' && body.detail ? body.detail : FALLBACK_DETAIL,
    fields: body?.fields && typeof body.fields === 'object' ? body.fields : undefined,
  };
}

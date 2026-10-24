import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { toApiError } from '../api/api-error';
import { AuthService, LOGIN_URL } from './auth.service';

const isApiRequest = (url: string) => url.startsWith('/api/');

/** Añade el Bearer token solo a peticiones a nuestra API (nunca a terceros) y nunca al login. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiRequest(request.url) || request.url === LOGIN_URL) {
    return next(request);
  }
  const token = inject(AuthService).token();
  return next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request);
};

/**
 * Normaliza todos los errores HTTP a {@link ApiError}. Un 401 fuera del login significa sesión caducada o inválida:
 * se cierra la sesión y se vuelve al login conservando la ruta actual.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && request.url !== LOGIN_URL) {
        auth.sessionExpired(router.url);
      }
      return throwError(() => toApiError(error));
    }),
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Rutas privadas: sin sesión, al login recordando a dónde quería ir el alumno. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.token() !== null
    ? true
    : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Login: si ya hay sesión, directamente a "Mis cursos". */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.token() === null ? true : inject(Router).createUrlTree(['/courses']);
};

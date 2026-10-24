import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { LoginResponse, Session, Student } from './auth.models';

export const SESSION_STORAGE_KEY = 'edtech.session';
export const LOGIN_URL = '/api/auth/login';

/**
 * Sesión del alumno (signals). El token se guarda en sessionStorage: sobrevive a recargas pero se borra al cerrar
 * la pestaña. El backend es la autoridad: si responde 401, la sesión se descarta (ver errorInterceptor).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(restoreSession());

  readonly student = computed<Student | null>(() => this.session()?.student ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  /** Token vigente o `null` (si caducó, cierra la sesión local). */
  token(): string | null {
    const current = this.session();
    if (!current) {
      return null;
    }
    if (current.expiresAt <= Date.now()) {
      this.clear();
      return null;
    }
    return current.token;
  }

  login(email: string, password: string): Observable<Student> {
    return this.http.post<LoginResponse>(LOGIN_URL, { email, password }).pipe(
      tap((response) =>
        this.store({
          token: response.accessToken,
          expiresAt: Date.parse(response.expiresAt),
          student: response.student,
        }),
      ),
      map((response) => response.student),
    );
  }

  /** Cierre de sesión voluntario: el token es stateless y caduca solo; aquí se descarta en el cliente. */
  logout(): void {
    this.clear();
    void this.router.navigate(['/login']);
  }

  /** El backend rechazó el token (caducado o inválido): volver al login conservando a dónde iba el alumno. */
  sessionExpired(returnUrl: string): void {
    if (!this.session()) {
      return;
    }
    this.clear();
    void this.router.navigate(['/login'], { queryParams: { expired: 1, returnUrl } });
  }

  private store(session: Session): void {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    this.session.set(session);
  }

  private clear(): void {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    this.session.set(null);
  }
}

function restoreSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<Session>;
    const valid =
      typeof parsed.token === 'string' &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt > Date.now() &&
      typeof parsed.student?.id === 'string' &&
      typeof parsed.student?.displayName === 'string';
    if (!valid) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed as Session;
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

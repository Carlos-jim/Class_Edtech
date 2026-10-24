import { Session } from '../app/core/auth/auth.models';
import { SESSION_STORAGE_KEY } from '../app/core/auth/auth.service';

export const ANA_SESSION: Session = {
  token: 'token-ana',
  expiresAt: Date.now() + 60 * 60 * 1000,
  student: { id: 'a1', email: 'ana.garcia@demo.edtech', displayName: 'Ana García' },
};

/** Debe llamarse ANTES de inyectar AuthService (restaura la sesión al construirse). */
export function seedSession(session: Session = ANA_SESSION): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

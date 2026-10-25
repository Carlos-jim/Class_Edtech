import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { type Page, test as base, expect, request } from '@playwright/test';
import { LessonPage } from './pages/lesson-page';
import { LoginPage } from './pages/login-page';

export const LESSON_1 = 'e0000000-0000-4000-8000-000000000001';
export const LESSON_2 = 'e0000000-0000-4000-8000-000000000002';
export const DEMO_PASSWORD = 'Demo1234!';
export const USERS = {
  ana: { email: 'ana.garcia@demo.edtech', name: 'Ana García' },
  bruno: { email: 'bruno.lopez@demo.edtech', name: 'Bruno López' },
} as const;
export type DemoUser = keyof typeof USERS;

interface Session {
  readonly token: string;
  readonly expiresAt: number;
  readonly student: { id: string; email: string; displayName: string };
}

/** Un login por alumno y ejecución (los tests de login prueban la UI aparte): respeta el rate limit del backend. */
const sessions = new Map<DemoUser, Session>();

async function apiLogin(baseURL: string, user: DemoUser): Promise<Session> {
  const cached = sessions.get(user);
  if (cached) {
    return cached;
  }
  const api = await request.newContext({ baseURL });
  const response = await api.post('/api/auth/login', { data: { email: USERS[user].email, password: DEMO_PASSWORD } });
  expect(response.ok(), `login de ${user}: ${response.status()}`).toBeTruthy();
  const body = await response.json();
  await api.dispose();
  const session: Session = { token: body.accessToken, expiresAt: Date.parse(body.expiresAt), student: body.student };
  sessions.set(user, session);
  return session;
}

/** Borra las conversaciones para que cada test empiece con el tutor vacío (BD del stack de docker compose). */
/**
 * Sustituye speechSynthesis por un doble que registra lo que se lee (headless no tiene voces) y emite "start"
 * como un navegador real. Con {@code silent} imita un navegador sin voces: acepta el texto pero nunca suena.
 */
export async function stubSpeechSynthesis(page: Page, { silent = false } = {}): Promise<void> {
  await page.addInitScript((silent) => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (utterance: SpeechSynthesisUtterance) => {
          spoken.push(utterance.text);
          if (!silent) {
            setTimeout(() => utterance.onstart?.(new Event('start') as SpeechSynthesisEvent), 0);
          }
        },
        cancel: () => undefined,
        resume: () => undefined,
        getVoices: () => [],
      },
    });
  }, silent);
}

export function resetConversations(): void {
  const user = process.env['DB_USER'] ?? 'tutor';
  const db = process.env['DB_NAME'] ?? 'tutor';
  execSync(`docker compose exec -T postgres psql -U ${user} -d ${db} -qc "DELETE FROM conversation"`, {
    cwd: resolve(__dirname, '../..'),
    stdio: 'pipe',
  });
}

export const test = base.extend<{
  loginPage: LoginPage;
  lessonPage: LessonPage;
  /** Abre la app ya autenticado como el alumno indicado (sesión inyectada, sin pasar por el formulario). */
  signInAs: (user: DemoUser) => Promise<Session>;
  apiToken: (user: DemoUser) => Promise<string>;
}>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  lessonPage: async ({ page }, use) => use(new LessonPage(page)),
  signInAs: async ({ page, baseURL }, use) => {
    await use(async (user) => {
      const session = await apiLogin(baseURL!, user);
      await page.addInitScript(
        ([key, value]) => window.sessionStorage.setItem(key, value),
        ['edtech.session', JSON.stringify(session)] as const,
      );
      return session;
    });
  },
  apiToken: async ({ baseURL }, use) => use(async (user) => (await apiLogin(baseURL!, user)).token),
});

export { expect };

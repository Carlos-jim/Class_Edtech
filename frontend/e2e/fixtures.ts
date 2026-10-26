import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
export const STUDENT_IDS: Record<DemoUser, string> = {
  ana: 'a1b2c3d4-0000-4000-8000-000000000001',
  bruno: 'a1b2c3d4-0000-4000-8000-000000000002',
};

/**
 * Firma un JWT como lo hace el backend (HS256, emisor lms-tutor) con el JWT_SECRET del .env del stack.
 * Permite probar casos reales de servidor, como un token ya caducado, sin esperar dos horas.
 */
export function mintToken(user: DemoUser, { expiresInSeconds }: { expiresInSeconds: number }): string {
  const env = readFileSync(resolve(__dirname, '../../.env'), 'utf8');
  const secret = env.match(/^JWT_SECRET=(.*)$/m)?.[1]?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET no encontrado en .env (necesario para firmar tokens de prueba)');
  }
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256' });
  const payload = encode({
    iss: 'lms-tutor',
    sub: STUDENT_IDS[user],
    name: USERS[user].name,
    iat: now - 7200,
    exp: now + expiresInSeconds,
  });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/** Inyecta en el navegador una sesión con el token indicado (el cliente la cree vigente durante una hora). */
export async function injectSession(page: Page, user: DemoUser, token: string): Promise<void> {
  const session = {
    token,
    expiresAt: Date.now() + 3600_000,
    student: { id: STUDENT_IDS[user], email: USERS[user].email, displayName: USERS[user].name },
  };
  await page.addInitScript(
    ([key, value]) => window.sessionStorage.setItem(key, value),
    ['edtech.session', JSON.stringify(session)] as const,
  );
}

/** Captura el cuerpo de las peticiones POST a una ruta de la API sin alterarlas. */
export async function captureRequestBody(page: Page, pattern: string): Promise<Buffer[]> {
  const bodies: Buffer[] = [];
  await page.route(pattern, async (route) => {
    if (route.request().method() === 'POST') {
      bodies.push(route.request().postDataBuffer() ?? Buffer.alloc(0));
    }
    await route.fallback();
  });
  return bodies;
}

/** Respuesta de error de la API con el formato real del backend (RFC 9457 + code). */
export function problem(status: number, code: string, detail: string) {
  return {
    status,
    contentType: 'application/problem+json',
    body: JSON.stringify({ type: 'about:blank', status, code, detail }),
  };
}

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
/**
 * Síntesis de voz simulada. Por defecto el navegador tiene una voz en español; `voices: false` simula Linux/Opera sin
 * voces y `silent` un motor que acepta el texto pero nunca suena. Cada texto leído se guarda en `window.__spoken`.
 */
export async function stubSpeechSynthesis(page: Page, { silent = false, voices = true } = {}): Promise<void> {
  await page.addInitScript(
    ({ silent, voices }) => {
      const spoken: string[] = [];
      (window as unknown as { __spoken: string[] }).__spoken = spoken;
      // El constructor real no admite voces simuladas: se sustituye por uno equivalente.
      class FakeUtterance {
        lang = '';
        rate = 1;
        voice: unknown = null;
        onstart: ((event: Event) => void) | null = null;
        onend: ((event: Event) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        constructor(readonly text: string) {}
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          speak: (utterance: FakeUtterance) => {
            spoken.push(utterance.text);
            if (!silent) {
              setTimeout(() => utterance.onstart?.(new Event('start')), 0);
            }
          },
          cancel: () => undefined,
          resume: () => undefined,
          getVoices: () => (voices ? [{ lang: 'es-ES', name: 'Voz de prueba', default: true, localService: true }] : []),
        },
      });
    },
    { silent, voices },
  );
}

/** Registra los audios que la página reproduce (el audio de las respuestas generado en el servidor) en `window.__played`. */
export async function recordAudioPlayback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const played: string[] = [];
    (window as unknown as { __played: string[] }).__played = played;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      played.push(this.src);
      return play.call(this);
    };
  });
}

export async function playedAudios(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __played: string[] }).__played);
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

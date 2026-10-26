import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de la interfaz contra el stack real (nginx + backend + PostgreSQL).
 *
 *   Stack Docker:  docker compose up -d --build   →  E2E_BASE_URL=http://localhost:8080 npm run e2e
 *   Solo enunciado: E2E_BASE_URL=http://localhost:8080 npm run e2e:poc   (tolerante a la IA real)
 *   IA real:       E2E_BASE_URL=http://localhost:8080 npm run e2e:live  (stack con Gemini; gasta cuota)
 *   Otros motores: npm run e2e -- --project=firefox --project=webkit  (tests @cross)
 *   Desarrollo:    backend en :8080 + `npm start` →  npm run e2e   (usa http://localhost:4200)
 *
 * Micrófono simulado por Chromium (--use-fake-device-for-media-stream): permite probar la grabación de voz.
 * Con STT real (Whisper) el tono del fake-device no es habla: e2e:poc fija la transcripción en ese caso.
 */
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1, // los tests comparten los alumnos de demostración
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    locale: 'es-ES',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /responsive|live-ai/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive/ },
    // Otros motores: solo el recorrido principal y la voz (tests con la etiqueta @cross).
    {
      name: 'firefox',
      grep: /@cross/,
      testIgnore: /live-ai/,
      use: {
        ...devices['Desktop Firefox'],
        permissions: [], // Firefox no admite el permiso "microphone": lo conceden estas preferencias
        launchOptions: {
          firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true },
        },
      },
    },
    {
      name: 'webkit',
      grep: /@cross/,
      testIgnore: /live-ai/,
      use: {
        ...devices['Desktop Safari'],
        permissions: [],
        launchOptions: {}, // sin micrófono simulado: la voz se omite
        // En sistemas sin soporte de WebKit (p. ej. Fedora), el navegador puede correr en la imagen oficial de
        // Playwright: PW_WEBKIT_WS=ws://localhost:3333/ (ver README).
        ...(process.env['PW_WEBKIT_WS'] ? { connectOptions: { wsEndpoint: process.env['PW_WEBKIT_WS'] } } : {}),
      },
    },
    // IA real (Gemini u otro proveedor). Solo con E2E_LIVE=1 (npm run e2e:live): gasta cuota y depende de la red.
    ...(process.env['E2E_LIVE']
      ? [
          {
            name: 'live',
            testMatch: /live-ai/,
            timeout: 240_000, // la IA real puede tener picos de demanda: el test reintenta como un alumno
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 1440, height: 900 },
              launchOptions: {
                // El "micrófono" reproduce una pregunta hablada real: se transcribe con el proveedor de verdad.
                args: [
                  '--use-fake-ui-for-media-stream',
                  '--use-fake-device-for-media-stream',
                  `--use-file-for-fake-audio-capture=${resolve(__dirname, 'e2e/assets/pregunta-post.wav')}`,
                ],
              },
            },
          },
        ]
      : []),
  ],
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : { command: 'npm start', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});

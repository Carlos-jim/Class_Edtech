import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de la interfaz contra el stack real (nginx + backend + PostgreSQL).
 *
 *   Stack Docker:  docker compose up -d --build   →  E2E_BASE_URL=http://localhost:8080 npm run e2e
 *   Solo enunciado: E2E_BASE_URL=http://localhost:8080 npm run e2e:poc   (tolerante a la IA real)
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
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /responsive/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive/ },
  ],
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : { command: 'npm start', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});

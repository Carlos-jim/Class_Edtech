import { LESSON_2, captureRequestBody, expect, problem, resetConversations, stubSpeechSynthesis, test } from './fixtures';

/**
 * Casos límite de la voz. La grabación real (micrófono simulado del navegador) se combina con respuestas del backend
 * forzadas cuando el caso no se puede provocar con el proveedor simulado (p. ej. "no se detectó voz").
 */
test.describe('Voz · casos límite', () => {
  test.beforeEach(async ({ page, signInAs, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit no ofrece micrófono simulado en Playwright');
    resetConversations();
    await stubSpeechSynthesis(page);
    await signInAs('ana');
  });

  test(
    'la grabación se sube como WAV PCM 16 kHz mono, el formato que aceptan todos los proveedores',
    { tag: '@cross' },
    async ({ page, lessonPage }) => {
      const uploads = await captureRequestBody(page, '**/api/transcriptions');
      await lessonPage.goto(LESSON_2);

      await lessonPage.micButton.click();
      await expect(lessonPage.recordingBar).toBeVisible();
      await page.waitForTimeout(1500);
      await lessonPage.stopRecordingButton.click();
      await expect(lessonPage.voiceReview).toBeVisible();

      expect(uploads).toHaveLength(1);
      const body = uploads[0]!;
      const multipart = body.toString('latin1');
      expect(multipart).toContain('filename="pregunta.wav"');
      expect(multipart).toContain('Content-Type: audio/wav');

      const riff = body.indexOf('RIFF');
      expect(riff, 'el audio debe ser un WAV (cabecera RIFF)').toBeGreaterThan(0);
      expect(body.toString('latin1', riff + 8, riff + 12)).toBe('WAVE');
      expect(body.readUInt16LE(riff + 20), 'PCM').toBe(1);
      expect(body.readUInt16LE(riff + 22), 'mono').toBe(1);
      expect(body.readUInt32LE(riff + 24), '16 kHz').toBe(16_000);
      expect(body.readUInt16LE(riff + 34), '16 bits').toBe(16);
      // ~1,5 s de audio a 16 kHz × 2 bytes ≈ 48 KB: muy lejos del límite de 5 MB
      expect(body.length).toBeLessThan(200 * 1024);
    },
  );

  test('si no se detecta voz se explica y «Grabar de nuevo» vuelve a abrir el micrófono', async ({ page, lessonPage }) => {
    await page.route('**/api/transcriptions', (route) =>
      route.fulfill(problem(422, 'NO_SPEECH_DETECTED', 'No se ha detectado voz en la grabación. Inténtalo de nuevo o escribe tu pregunta')),
    );
    await lessonPage.goto(LESSON_2);

    await lessonPage.micButton.click();
    await page.waitForTimeout(800);
    await lessonPage.stopRecordingButton.click();

    await expect(lessonPage.error).toContainText('No se ha detectado voz');
    await expect(lessonPage.composer).toHaveValue('');
    await lessonPage.error.getByRole('button', { name: 'Grabar de nuevo' }).click();

    await expect(lessonPage.recordingBar).toBeVisible();
    await expect(lessonPage.error).toHaveCount(0);
  });

  test('una grabación demasiado grande (413) se explica sin perder el control del micrófono', async ({ page, lessonPage }) => {
    await page.route('**/api/transcriptions', (route) =>
      route.fulfill(problem(413, 'AUDIO_TOO_LARGE', 'La grabación es demasiado larga. Graba una pregunta más breve')),
    );
    await lessonPage.goto(LESSON_2);

    await lessonPage.micButton.click();
    await page.waitForTimeout(800);
    await lessonPage.stopRecordingButton.click();

    await expect(lessonPage.error).toContainText('La grabación es demasiado larga');
    await expect(lessonPage.error.getByRole('button', { name: 'Grabar de nuevo' })).toBeVisible();
    await expect(lessonPage.micButton).toBeEnabled();
    await expect(lessonPage.studentMessages).toHaveCount(0);
  });

  test('a los 60 s la grabación se detiene sola y pasa a transcribirse', async ({ page, lessonPage }) => {
    await page.clock.install();
    await lessonPage.goto(LESSON_2);

    await lessonPage.micButton.click();
    await expect(lessonPage.recordingBar).toBeVisible();
    await expect(lessonPage.recordingBar).toContainText('/ 01:00');

    await page.clock.runFor(61_000);

    await expect(lessonPage.recordingBar).toHaveCount(0);
    await expect(lessonPage.voiceReview).toBeVisible();
    await expect(lessonPage.composer).toHaveValue('¿Para qué sirve POST?');
  });
});

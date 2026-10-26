import { LESSON_2, expect, resetConversations, stubSpeechSynthesis, test } from './fixtures';

test.describe('Interacción por voz', () => {
  test.beforeEach(async ({ page, signInAs }) => {
    resetConversations();
    await stubSpeechSynthesis(page);
    await signInAs('ana');
  });

  test('grabar → transcribir → revisar y editar → enviar como pregunta de voz → escuchar la respuesta', { tag: '@cross' }, async ({
    page,
    lessonPage,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'WebKit no ofrece micrófono simulado en Playwright');
    await lessonPage.goto(LESSON_2);

    await lessonPage.micButton.click();
    await expect(lessonPage.recordingBar).toBeVisible();
    await expect(lessonPage.status).toContainText('Escuchando');
    await page.waitForTimeout(1500); // micrófono simulado de Chromium
    await lessonPage.stopRecordingButton.click();

    // Revisión: el texto transcrito es editable y tiene el foco
    await expect(lessonPage.voiceReview).toBeVisible();
    await expect(lessonPage.composer).toHaveValue('¿Para qué sirve POST?');
    await expect(lessonPage.composer).toBeFocused();
    await lessonPage.composer.fill('¿Para qué sirve POST en una API?');
    await lessonPage.composer.press('Enter');

    await expect(lessonPage.studentMessages.last()).toHaveText('¿Para qué sirve POST en una API?');
    await expect(page.locator('app-chat-message').filter({ has: lessonPage.studentMessages }).last()).toContainText('Por voz');
    await expect(lessonPage.answer(0)).toContainText('crear un nuevo recurso');

    // La respuesta de una pregunta por voz se lee en voz alta
    await expect(page.getByRole('button', { name: 'Detener lectura de la respuesta' })).toBeVisible();
    const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.join(' '));
    expect(spoken).toContain('crear un nuevo recurso');
  });

  test('cancelar una grabación no envía nada', async ({ lessonPage, page }) => {
    await lessonPage.goto(LESSON_2);

    await lessonPage.micButton.click();
    await expect(lessonPage.recordingBar).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar grabación' }).click();

    await expect(lessonPage.recordingBar).toHaveCount(0);
    await expect(lessonPage.composer).toHaveValue('');
    await expect(lessonPage.studentMessages).toHaveCount(0);
  });

  test('sin permiso de micrófono se explica y se puede escribir en su lugar', async ({ page, lessonPage }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denegado', 'NotAllowedError'));
    });
    await lessonPage.goto(LESSON_2);

    await lessonPage.micButton.click();

    await expect(lessonPage.error).toContainText('No tenemos permiso para usar el micrófono');
    await lessonPage.error.getByRole('button', { name: 'Escribir en su lugar' }).click();
    await expect(lessonPage.error).toHaveCount(0);
    await expect(lessonPage.composer).toBeFocused();
  });

  test('si la transcripción falla, se reintenta con la misma grabación', async ({ page, lessonPage }) => {
    let uploads = 0;
    await page.route('**/api/transcriptions', async (route) => {
      uploads++;
      if (uploads === 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({ status: 503, code: 'TRANSCRIPTION_UNAVAILABLE', detail: 'No se pudo transcribir el audio.' }),
        });
      }
      return route.fallback();
    });
    await lessonPage.goto(LESSON_2);

    await lessonPage.micButton.click();
    await page.waitForTimeout(1200);
    await lessonPage.stopRecordingButton.click();
    await expect(lessonPage.error).toContainText('No se pudo transcribir el audio');

    await lessonPage.error.getByRole('button', { name: 'Reintentar' }).click();

    await expect(lessonPage.composer).toHaveValue('¿Para qué sirve POST?');
    await expect(lessonPage.recordingBar).toHaveCount(0);
    expect(uploads).toBe(2);
  });
});

test.describe('Lectura en voz alta sin voces en el navegador', () => {
  test.beforeEach(async ({ page, signInAs }) => {
    resetConversations();
    await stubSpeechSynthesis(page, { silent: true });
    await signInAs('ana');
  });

  test('si no llega a sonar se avisa en lugar de quedarse en silencio', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);
    await lessonPage.ask('¿Para qué sirve POST?');
    await expect(lessonPage.tutorMessages).toHaveCount(1);

    await page.getByRole('button', { name: 'Escuchar respuesta' }).click();

    await expect(lessonPage.error).toContainText('no ha podido leer la respuesta en voz alta');
    await expect(page.getByRole('button', { name: 'Escuchar respuesta' })).toBeVisible();
  });
});

test.describe('Navegador sin síntesis de voz', () => {
  test.beforeEach(async ({ page, signInAs }) => {
    resetConversations();
    // Como Firefox/LibreWolf con la síntesis desactivada: la API no existe.
    await page.addInitScript(() => {
      delete (Window.prototype as unknown as { speechSynthesis?: unknown }).speechSynthesis;
      delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    });
    await signInAs('ana');
  });

  test('el botón Escuchar sigue visible y explica por qué no puede leer la respuesta', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);
    expect(await page.evaluate(() => 'speechSynthesis' in window)).toBe(false);

    await lessonPage.askAndAwait('¿Para qué sirve POST?', 1);
    await page.getByRole('button', { name: 'Escuchar respuesta' }).click();

    await expect(lessonPage.error).toContainText('Este navegador no permite leer respuestas en voz alta');
    await lessonPage.error.getByRole('button', { name: 'Entendido' }).click();
    await expect(lessonPage.error).toHaveCount(0);
    await expect(lessonPage.answer(0)).toContainText('crear un nuevo recurso');
  });
});

import { LESSON_2, expect, resetConversations, test } from './fixtures';

/** Sustituye speechSynthesis por un doble que registra lo que se lee (headless no tiene voces). */
async function stubSpeechSynthesis(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (utterance: SpeechSynthesisUtterance) => spoken.push(utterance.text),
        cancel: () => undefined,
        getVoices: () => [],
      },
    });
  });
}

test.describe('Interacción por voz', () => {
  test.beforeEach(async ({ page, signInAs }) => {
    resetConversations();
    await stubSpeechSynthesis(page);
    await signInAs('ana');
  });

  test('grabar → transcribir → revisar y editar → enviar como pregunta de voz → escuchar la respuesta', async ({
    page,
    lessonPage,
  }) => {
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

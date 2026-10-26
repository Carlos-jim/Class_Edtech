import { LESSON_2, expect, resetConversations, stubSpeechSynthesis, test } from './fixtures';

/**
 * E2E contra el proveedor de IA REAL (por defecto Gemini): `npm run e2e:live` con el stack levantado con la clave.
 * No se ejecuta en la CI (gasta cuota y depende de la red). Las aserciones son semánticas: el texto exacto del modelo
 * varía, pero la insignia de grounding, la cita y la transcripción deben cumplirse.
 *
 * El micrófono simulado reproduce e2e/assets/pregunta-post.wav («¿Para qué sirve el método POST?»).
 */
test.describe('IA real', () => {
  test.skip(!process.env['E2E_LIVE'], 'Solo con E2E_LIVE=1 (npm run e2e:live)');

  test.beforeEach(async ({ page, signInAs }) => {
    resetConversations();
    await stubSpeechSynthesis(page);
    await signInAs('ana');
  });

  test('responde con la lección y muestra la cita verificada', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);

    await lessonPage.ask('¿Para qué sirve POST?');
    await lessonPage.awaitAnswers(1);

    const answer = page.locator('app-chat-message').filter({ has: lessonPage.tutorMessages }).first();
    await expect(answer).toContainText('Basado en la lección');
    await expect(answer).toContainText('De la lección');
    await expect(lessonPage.answer(0)).toContainText(/crea|recurso/i);
  });

  test('indica cuando la lección no cubre la pregunta', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);

    await lessonPage.ask('¿Cuál es la capital de Francia?');
    await lessonPage.awaitAnswers(1);

    const answer = page.locator('app-chat-message').filter({ has: lessonPage.tutorMessages }).first();
    await expect(answer).toContainText('Sin información suficiente en la lección');
    await expect(answer).not.toContainText('De la lección');
  });

  test('transcribe una pregunta hablada real y responde con la lección', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);

    await lessonPage.micButton.click();
    await expect(lessonPage.recordingBar).toBeVisible();
    await page.waitForTimeout(5_000); // dura la pregunta grabada (4,5 s)
    await lessonPage.stopRecordingButton.click();

    await expect(lessonPage.voiceReview).toBeVisible({ timeout: 45_000 });
    await expect(lessonPage.composer).toHaveValue(/post/i);
    await lessonPage.composer.press('Enter');

    await lessonPage.awaitAnswers(1);
    const answer = page.locator('app-chat-message').filter({ has: lessonPage.tutorMessages }).first();
    await expect(answer).toContainText('Basado en la lección');
    await expect(page.locator('app-chat-message').filter({ has: lessonPage.studentMessages }).first()).toContainText(
      'Por voz',
    );
  });
});

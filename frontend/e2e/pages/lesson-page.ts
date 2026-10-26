import { expect, type Locator, type Page } from '@playwright/test';

/** Page Object de la pantalla de lección + panel del tutor. */
export class LessonPage {
  readonly title: Locator;
  readonly body: Locator;
  readonly composer: Locator;
  readonly sendButton: Locator;
  readonly micButton: Locator;
  readonly stopRecordingButton: Locator;
  readonly recordingBar: Locator;
  readonly voiceReview: Locator;
  readonly studentMessages: Locator;
  readonly tutorMessages: Locator;
  readonly status: Locator;
  readonly error: Locator;
  readonly denied: Locator;

  constructor(readonly page: Page) {
    this.title = page.getByRole('heading', { level: 1 });
    this.body = page.getByTestId('lesson-body');
    this.composer = page.getByLabel('Escribe tu pregunta');
    this.sendButton = page.getByRole('button', { name: 'Enviar pregunta' });
    this.micButton = page.getByRole('button', { name: /Preguntar por voz|Volver a grabar/ });
    this.stopRecordingButton = page.getByRole('button', { name: 'Detener y transcribir' });
    this.recordingBar = page.getByTestId('recording-bar');
    this.voiceReview = page.getByTestId('voice-review');
    this.studentMessages = page.getByTestId('student-message');
    this.tutorMessages = page.getByTestId('tutor-message');
    this.status = page.getByTestId('tutor-status');
    this.error = page.getByRole('alert');
    this.denied = page.getByTestId('lesson-denied');
  }

  async goto(lessonId: string): Promise<void> {
    await this.page.goto(`/lessons/${lessonId}`);
  }

  async ask(question: string): Promise<void> {
    await this.composer.fill(question);
    await this.composer.press('Enter');
  }

  /**
   * Envía la pregunta y espera N respuestas del tutor. Si el proveedor de IA cae (429/400), pulsa Reintentar
   * hasta {@code retries} veces antes de fallar.
   */
  async askAndAwait(question: string, expectedTutorCount: number, retries = 2): Promise<void> {
    await this.ask(question);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await expect(this.tutorMessages).toHaveCount(expectedTutorCount, { timeout: 45_000 });
        return;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        const retryBtn = this.error.getByRole('button', { name: 'Reintentar' });
        if ((await this.error.count()) > 0 && (await retryBtn.count()) > 0) {
          await retryBtn.click();
        } else {
          await this.page.waitForTimeout(2_000);
          await this.ask(question);
        }
      }
    }
  }

  /**
   * Espera N respuestas del tutor tras un envío ya hecho. Si el proveedor de IA falla (503, timeout, circuito
   * abierto), espera y pulsa Reintentar como haría un alumno, hasta {@code retries} veces.
   */
  async awaitAnswers(expectedTutorCount: number, retries = 4, waitBetweenMs = 15_000): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        // 60 s: más que lo que tarda el backend en rendirse (timeout de 20 s + un reintento) con un proveedor lento
        await expect(this.tutorMessages).toHaveCount(expectedTutorCount, { timeout: 60_000 });
        return;
      } catch (error) {
        const retryButton = this.error.getByRole('button', { name: 'Reintentar' });
        if (attempt >= retries || (await retryButton.count()) === 0) {
          throw error;
        }
        await this.page.waitForTimeout(waitBetweenMs); // deja que pase el pico o que se cierre el circuito
        await retryButton.click();
      }
    }
  }

  /** Respuesta n-ésima del tutor (0 = primera) con su insignia de grounding. */
  answer(index: number): Locator {
    return this.tutorMessages.nth(index);
  }

  badgeOf(index: number): Locator {
    return this.page.locator('app-chat-message').filter({ has: this.tutorMessages }).nth(index);
  }
}

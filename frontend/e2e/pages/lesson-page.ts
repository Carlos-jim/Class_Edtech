import type { Locator, Page } from '@playwright/test';

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

  /** Respuesta n-ésima del tutor (0 = primera) con su insignia de grounding. */
  answer(index: number): Locator {
    return this.tutorMessages.nth(index);
  }

  badgeOf(index: number): Locator {
    return this.page.locator('app-chat-message').filter({ has: this.tutorMessages }).nth(index);
  }
}

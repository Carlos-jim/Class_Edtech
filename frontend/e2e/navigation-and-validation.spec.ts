import type { Page } from '@playwright/test';
import { DEMO_PASSWORD, LESSON_1, USERS, expect, resetConversations, test } from './fixtures';

/** Pulsa Tab hasta que el foco llegue al elemento indicado (máx. `limit` pulsaciones). */
async function tabUntil(page: Page, isTarget: () => Promise<boolean>, limit = 40): Promise<void> {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    if (await isTarget()) {
      return;
    }
  }
  throw new Error(`El foco no llegó al elemento esperado tras ${limit} tabulaciones`);
}

test.describe('Navegación entre lecciones', () => {
  test.beforeEach(async ({ signInAs }) => {
    resetConversations();
    await signInAs('ana');
  });

  test('anterior/siguiente cambia de lección y cada una conserva su propia conversación', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_1);
    await expect(lessonPage.title).toContainText('Introducción a las APIs REST');
    await lessonPage.ask('¿Qué es una API?');
    await expect(lessonPage.tutorMessages).toHaveCount(1);

    await page.getByRole('link', { name: /Siguiente/ }).click();
    await expect(lessonPage.title).toContainText('Métodos HTTP');
    await expect(lessonPage.studentMessages).toHaveCount(0);
    await lessonPage.ask('¿Qué hace GET?');
    await expect(lessonPage.tutorMessages).toHaveCount(1);

    await page.getByRole('link', { name: /Anterior/ }).click();
    await expect(lessonPage.title).toContainText('Introducción a las APIs REST');
    await expect(lessonPage.studentMessages).toHaveText(['¿Qué es una API?']);
  });
});

test.describe('Validación de la pregunta', () => {
  test.beforeEach(async ({ signInAs }) => {
    resetConversations();
    await signInAs('ana');
  });

  test('no se pueden enviar preguntas vacías ni solo con espacios', async ({ page, lessonPage }) => {
    let posts = 0;
    page.on('request', (r) => r.method() === 'POST' && r.url().includes('/messages') && posts++);
    await lessonPage.goto(LESSON_1);

    await expect(lessonPage.sendButton).toBeDisabled();
    await lessonPage.composer.fill('     ');
    await expect(lessonPage.sendButton).toBeDisabled();
    await lessonPage.composer.press('Enter');

    await page.waitForTimeout(300);
    expect(posts).toBe(0);
    await expect(lessonPage.studentMessages).toHaveCount(0);
  });

  test('cerca del límite se muestra el contador y nunca se envían más de 2000 caracteres', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_1);

    await lessonPage.composer.fill('a'.repeat(1900));
    await expect(page.getByText('1900/2000')).toBeVisible();
    await expect(lessonPage.sendButton).toBeEnabled();

    await lessonPage.composer.fill('a'.repeat(2100));
    const length = (await lessonPage.composer.inputValue()).trim().length;
    if (length > 2000) {
      // Si el navegador no recorta al pegar, la interfaz impide el envío.
      await expect(lessonPage.sendButton).toBeDisabled();
    } else {
      expect(length).toBe(2000);
    }
  });
});

test.describe('Uso solo con teclado', () => {
  test('login → curso → lección → pregunta sin usar el ratón', async ({ page, lessonPage }) => {
    resetConversations();
    await page.goto('/login');

    await tabUntil(page, () => page.getByLabel('Correo electrónico').evaluate((el) => el === document.activeElement));
    await page.keyboard.type(USERS.ana.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(DEMO_PASSWORD);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/courses$/);

    const start = page.getByRole('link', { name: /Empezar curso/ });
    await tabUntil(page, () => start.evaluate((el) => el === document.activeElement));
    await page.keyboard.press('Enter');
    await expect(lessonPage.title).toContainText('Introducción a las APIs REST');

    await tabUntil(page, () => lessonPage.composer.evaluate((el) => el === document.activeElement), 60);
    await page.keyboard.type('¿Qué es REST?');
    await page.keyboard.press('Enter');

    await expect(lessonPage.studentMessages).toHaveText(['¿Qué es REST?']);
    await expect(lessonPage.tutorMessages).toHaveCount(1);
  });
});

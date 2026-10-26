import { LESSON_2, expect, resetConversations, test } from './fixtures';

test.describe('Tutor IA por texto', () => {
  test.beforeEach(async ({ signInAs }) => {
    resetConversations();
    await signInAs('ana');
  });

  test('recorrido: curso → lección → pregunta con respuesta basada en el material', { tag: '@cross' }, async ({ page, lessonPage }) => {
    await page.goto('/courses');
    await page.getByRole('link', { name: /Empezar curso: Fundamentos de APIs REST/ }).click();
    await expect(lessonPage.title).toContainText('Introducción a las APIs REST');

    await page.getByRole('link', { name: /Métodos HTTP/ }).first().click();
    await expect(lessonPage.title).toContainText('Métodos HTTP');
    await expect(lessonPage.body.getByRole('heading', { name: 'POST — Crear' })).toBeVisible();

    await lessonPage.ask('¿Para qué sirve POST?');

    await expect(lessonPage.studentMessages.last()).toHaveText('¿Para qué sirve POST?');
    await expect(lessonPage.answer(0)).toContainText('crear un nuevo recurso');
    await expect(lessonPage.badgeOf(0)).toContainText('Basado en la lección');
  });

  test('si la lección no cubre la pregunta, el tutor lo indica', { tag: '@cross' }, async ({ lessonPage }) => {
    await lessonPage.goto(LESSON_2);

    await lessonPage.ask('¿Cuál es la capital de Francia?');

    await expect(lessonPage.answer(0)).toContainText('No encuentro información suficiente');
    await expect(lessonPage.badgeOf(0)).toContainText('Sin información suficiente en la lección');
  });

  test('la conversación se recupera en una visita posterior', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);
    await lessonPage.ask('¿Qué hace GET?');
    await expect(lessonPage.tutorMessages).toHaveCount(1);

    await page.goto('/courses');
    await lessonPage.goto(LESSON_2);

    await expect(lessonPage.studentMessages).toHaveText(['¿Qué hace GET?']);
    await expect(lessonPage.tutorMessages).toHaveCount(1);
  });

  test('las preguntas sugeridas se envían con un clic', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);

    await page.getByRole('button', { name: 'Explícame: POST' }).click();

    await expect(lessonPage.answer(0)).toContainText('POST');
  });

  test('si el servicio de IA falla, la pregunta no se pierde y se puede reintentar', async ({ page, lessonPage }) => {
    let failNext = true;
    await page.route('**/api/lessons/*/messages', async (route) => {
      if (route.request().method() === 'POST' && failNext) {
        failNext = false;
        return route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({ status: 503, code: 'AI_UNAVAILABLE', detail: 'El tutor no está disponible en este momento.' }),
        });
      }
      return route.fallback();
    });
    await lessonPage.goto(LESSON_2);

    await lessonPage.ask('¿Qué es PATCH?');

    await expect(lessonPage.error).toContainText('El tutor no está disponible');
    await expect(lessonPage.composer).toHaveValue('¿Qué es PATCH?');
    await expect(lessonPage.tutorMessages).toHaveCount(0);

    await lessonPage.error.getByRole('button', { name: 'Reintentar' }).click();

    await expect(lessonPage.answer(0)).toContainText('PATCH');
    await expect(lessonPage.error).toHaveCount(0);
  });

  test('sin conexión se avisa y la pregunta se conserva', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);
    await page.route('**/api/lessons/*/messages', (route) =>
      route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.fallback(),
    );

    await lessonPage.ask('¿Qué es DELETE?');

    await expect(lessonPage.error).toContainText('No hay conexión con el servidor');
    await expect(lessonPage.composer).toHaveValue('¿Qué es DELETE?');
  });

  test('el contenido del alumno se muestra como texto, nunca como HTML (XSS)', async ({ page, lessonPage }) => {
    let alerted = false;
    page.on('dialog', async (dialog) => {
      alerted = true;
      await dialog.dismiss();
    });
    await lessonPage.goto(LESSON_2);

    await lessonPage.ask('<img src=x onerror=alert(1)> ¿Qué es POST?');

    await expect(lessonPage.studentMessages.last()).toHaveText('<img src=x onerror=alert(1)> ¿Qué es POST?');
    await expect(lessonPage.tutorMessages).toHaveCount(1);
    expect(alerted).toBe(false);
  });
});

import { LESSON_1, LESSON_2, expect, resetConversations, test } from './fixtures';

test.describe('Control de acceso', () => {
  test.beforeEach(() => resetConversations());

  test('el alumno sin matrícula no tiene cursos', async ({ page, signInAs }) => {
    await signInAs('bruno');
    await page.goto('/courses');

    await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();
    await expect(page.getByTestId('current-user')).toHaveText('Bruno López');
    await expect(page.getByTestId('courses-empty')).toContainText('Aún no tienes cursos asignados');
  });

  test('el alumno sin matrícula no puede abrir la lección aunque conozca la URL', async ({ signInAs, lessonPage }) => {
    await signInAs('bruno');
    await lessonPage.goto(LESSON_2);

    await expect(lessonPage.denied).toContainText('No tienes acceso a esta lección');
    await expect(lessonPage.body).toHaveCount(0);
    await expect(lessonPage.composer).toHaveCount(0);
  });

  test('nadie puede leer los mensajes de otro alumno a través de la API (IDOR)', async ({
    signInAs,
    lessonPage,
    request,
    apiToken,
  }) => {
    await signInAs('ana');
    await lessonPage.goto(LESSON_1);
    await lessonPage.ask('¿Qué es REST? (pregunta privada de Ana)');
    await expect(lessonPage.tutorMessages).toHaveCount(1);

    const brunoToken = await apiToken('bruno');
    const response = await request.get(`/api/lessons/${LESSON_1}/messages`, {
      headers: { Authorization: `Bearer ${brunoToken}` },
    });

    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain('privada de Ana');
  });

  test('sin token la API no devuelve nada', async ({ request }) => {
    const response = await request.get(`/api/lessons/${LESSON_2}`);

    expect(response.status()).toBe(401);
  });
});

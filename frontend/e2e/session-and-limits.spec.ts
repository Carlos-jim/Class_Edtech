import {
  DEMO_PASSWORD,
  LESSON_2,
  USERS,
  expect,
  injectSession,
  mintToken,
  problem,
  resetConversations,
  test,
} from './fixtures';

test.describe('Sesión y límites de uso', () => {
  test.beforeEach(() => resetConversations());

  test('un token firmado por el servidor da acceso (control del caso siguiente)', async ({ page, lessonPage }) => {
    await injectSession(page, 'ana', mintToken('ana', { expiresInSeconds: 600 }));

    await lessonPage.goto(LESSON_2);

    await expect(lessonPage.title).toContainText('Métodos HTTP');
  });

  test('con el token caducado en el servidor se vuelve al login y, al entrar, a la misma lección', async ({
    page,
    lessonPage,
    loginPage,
  }) => {
    // Caducado hace 5 min (más que el margen de reloj del servidor); el navegador aún la cree vigente.
    await injectSession(page, 'ana', mintToken('ana', { expiresInSeconds: -300 }));

    await lessonPage.goto(LESSON_2);

    await expect(page).toHaveURL(/\/login\?.*expired=1/);
    await expect(page.getByText('Tu sesión ha caducado')).toBeVisible();
    await loginPage.login(USERS.ana.email, DEMO_PASSWORD);

    await expect(page).toHaveURL(new RegExp(`/lessons/${LESSON_2}$`));
    await expect(lessonPage.title).toContainText('Métodos HTTP');
  });

  test('si la sesión caduca a mitad de una pregunta, tras volver a entrar la conversación sigue ahí', async ({
    page,
    signInAs,
    lessonPage,
    loginPage,
  }) => {
    await signInAs('ana');
    await lessonPage.goto(LESSON_2);
    await lessonPage.ask('¿Qué hace GET?');
    await expect(lessonPage.tutorMessages).toHaveCount(1);

    let expireNext = true;
    await page.route('**/api/lessons/*/messages', (route) => {
      if (route.request().method() === 'POST' && expireNext) {
        expireNext = false;
        return route.fulfill(problem(401, 'UNAUTHENTICATED', 'Autenticación requerida o token no válido'));
      }
      return route.fallback();
    });
    await lessonPage.ask('¿Y DELETE?');

    await expect(page).toHaveURL(/\/login\?.*expired=1/);
    await loginPage.login(USERS.ana.email, DEMO_PASSWORD);

    await expect(page).toHaveURL(new RegExp(`/lessons/${LESSON_2}$`));
    await expect(lessonPage.studentMessages).toHaveText(['¿Qué hace GET?']);
  });

  test('al superar el límite de preguntas (429) se explica y la pregunta se conserva para reintentar', async ({
    page,
    signInAs,
    lessonPage,
  }) => {
    await signInAs('ana');
    let limited = true;
    await page.route('**/api/lessons/*/messages', (route) => {
      if (route.request().method() === 'POST' && limited) {
        limited = false;
        return route.fulfill({
          ...problem(429, 'RATE_LIMITED', 'Has hecho demasiadas peticiones seguidas. Espera un momento y vuelve a intentarlo'),
          headers: { 'Retry-After': '30' },
        });
      }
      return route.fallback();
    });
    await lessonPage.goto(LESSON_2);

    await lessonPage.ask('¿Qué es PUT?');

    await expect(lessonPage.error).toContainText('demasiadas peticiones');
    await expect(lessonPage.composer).toHaveValue('¿Qué es PUT?');
    await expect(lessonPage.tutorMessages).toHaveCount(0);

    await lessonPage.error.getByRole('button', { name: 'Reintentar' }).click();
    await expect(lessonPage.tutorMessages).toHaveCount(1);
  });
});

import { DEMO_PASSWORD, LESSON_2, USERS, expect, test } from './fixtures';

test.describe('Autenticación', () => {
  test('una ruta privada sin sesión lleva al login y, tras entrar, vuelve a esa ruta', async ({ page, loginPage }) => {
    await page.goto(`/lessons/${LESSON_2}`);

    await expect(page).toHaveURL(/\/login\?returnUrl=/);
    await loginPage.login(USERS.ana.email, DEMO_PASSWORD);

    await expect(page).toHaveURL(new RegExp(`/lessons/${LESSON_2}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Métodos HTTP');
  });

  test('credenciales incorrectas muestran un error genérico', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USERS.ana.email, 'incorrecta');

    await expect(loginPage.error).toContainText('Correo o contraseña incorrectos');
    await expect(page).toHaveURL(/\/login/);
  });

  test('cerrar sesión impide volver a las páginas privadas', async ({ page, loginPage }) => {
    await loginPage.goto();
    await page.getByRole('button', { name: /Ana García/ }).click();
    await expect(page.getByTestId('current-user')).toHaveText(USERS.ana.name);

    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/courses');
    await expect(page).toHaveURL(/\/login/);
  });
});

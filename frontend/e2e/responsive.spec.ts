import { LESSON_2, expect, resetConversations, test } from './fixtures';

test.describe('Móvil', () => {
  test.beforeEach(async ({ signInAs }) => {
    resetConversations();
    await signInAs('ana');
  });

  test('el tutor se abre a pantalla completa desde la lección', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);
    await expect(lessonPage.title).toContainText('Métodos HTTP');
    await expect(lessonPage.composer).toHaveCount(0);

    await page.getByRole('button', { name: 'Preguntar al tutor' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tutor IA' });
    await expect(dialog).toBeVisible();

    await lessonPage.ask('¿Para qué sirve POST?');
    await expect(lessonPage.answer(0)).toContainText('crear un nuevo recurso');

    await page.getByRole('button', { name: 'Cerrar tutor' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('el menú lateral muestra el temario y se cierra al navegar', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);

    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const menu = page.getByRole('dialog', { name: 'Menú' });
    await menu.getByRole('link', { name: /Introducción/ }).click();

    await expect(lessonPage.title).toContainText('Introducción a las APIs REST');
    await expect(menu).toHaveCount(0);
  });
});

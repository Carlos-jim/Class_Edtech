import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { LESSON_2, expect, resetConversations, test } from './fixtures';

/** Auditoría automática WCAG 2.1 A/AA con axe-core: no se admiten incidencias graves ni críticas. */
async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.help} → ${violation.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(serious, serious.join('\n')).toEqual([]);
}

test.describe('Accesibilidad (axe-core)', () => {
  test('login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test('mis cursos', async ({ page, signInAs }) => {
    await signInAs('ana');
    await page.goto('/courses');
    await expect(page.getByRole('link', { name: /Empezar/ })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test('lección con conversación', async ({ signInAs, lessonPage }) => {
    resetConversations();
    await signInAs('ana');
    await lessonPage.goto(LESSON_2);
    await lessonPage.ask('¿Para qué sirve POST?');
    await expect(lessonPage.tutorMessages).toHaveCount(1);
    await expectNoSeriousViolations(lessonPage.page);
  });
});

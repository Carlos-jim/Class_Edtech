import type { Locator, Page } from '@playwright/test';

/** Page Object de la pantalla de login. */
export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.email = page.getByLabel('Correo electrónico');
    this.password = page.getByLabel('Contraseña', { exact: true });
    this.submit = page.getByRole('button', { name: 'Entrar' });
    this.error = page.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}

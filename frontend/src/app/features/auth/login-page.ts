import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { AlertBanner } from '../../shared/ui/alert-banner';
import { Icon } from '../../shared/ui/icon';

interface DemoAccount {
  readonly label: string;
  readonly hint: string;
  readonly email: string;
}

export const DEMO_PASSWORD = 'Demo1234!';

/** Solo para que el evaluador pruebe rápido ambos casos del enunciado (credenciales ficticias del seed). */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { label: 'Ana García', hint: 'Con acceso al curso', email: 'ana.garcia@demo.edtech' },
  { label: 'Bruno López', hint: 'Sin acceso', email: 'bruno.lopez@demo.edtech' },
];

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, AlertBanner, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <!-- Panel de marca -->
      <aside class="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-12 text-white lg:flex lg:flex-col">
        <div class="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-violet-400/20 blur-3xl"></div>

        <div class="relative flex items-center gap-2.5 text-lg font-semibold">
          <span class="grid size-9 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25">
            <app-icon name="graduation-cap" [size]="20" />
          </span>
          EdTech Tutor
        </div>

        <div class="relative mt-auto max-w-md">
          <h2 class="text-3xl font-semibold leading-tight tracking-tight">Aprende a tu ritmo, con un tutor que conoce tu lección.</h2>
          <ul class="mt-8 space-y-4 text-indigo-50">
            <li class="flex gap-3">
              <app-icon name="mic" class="mt-0.5 text-indigo-200" />
              <span>Pregunta por escrito o en voz alta y escucha la respuesta.</span>
            </li>
            <li class="flex gap-3">
              <app-icon name="book-open" class="mt-0.5 text-indigo-200" />
              <span>Respuestas basadas en el contenido de la lección, sin inventar.</span>
            </li>
            <li class="flex gap-3">
              <app-icon name="refresh-cw" class="mt-0.5 text-indigo-200" />
              <span>Retoma tu conversación cuando vuelvas.</span>
            </li>
          </ul>
        </div>
        <p class="relative mt-12 text-sm text-indigo-200">Prueba de concepto · LMS con tutor de IA</p>
      </aside>

      <!-- Formulario -->
      <main class="flex items-center justify-center px-6 py-12 sm:px-12">
        <div class="w-full max-w-sm animate-fade-in">
          <div class="mb-8 flex items-center gap-2.5 text-lg font-semibold text-slate-900 lg:hidden">
            <span class="grid size-9 place-items-center rounded-lg bg-brand-600 text-white">
              <app-icon name="graduation-cap" [size]="20" />
            </span>
            EdTech Tutor
          </div>

          <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Inicia sesión</h1>
          <p class="mt-1.5 text-sm text-slate-500">Accede a tus cursos y a tu tutor virtual.</p>

          @if (sessionExpired()) {
            <app-alert-banner class="mt-6 block" tone="info" message="Tu sesión ha caducado. Vuelve a iniciar sesión para continuar." />
          }
          @if (error(); as err) {
            <app-alert-banner class="mt-6 block" [message]="err.detail" />
          }

          <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div>
              <label for="email" class="mb-1.5 block text-sm font-medium text-slate-700">Correo electrónico</label>
              <input
                id="email"
                type="email"
                class="input"
                formControlName="email"
                autocomplete="username"
                placeholder="tu@correo.com"
                [attr.aria-invalid]="showError('email')"
                aria-describedby="email-error"
              />
              @if (showError('email')) {
                <p id="email-error" class="mt-1.5 text-xs text-red-600">Introduce un correo válido.</p>
              }
            </div>

            <div>
              <label for="password" class="mb-1.5 block text-sm font-medium text-slate-700">Contraseña</label>
              <div class="relative">
                <input
                  id="password"
                  class="input pr-10"
                  formControlName="password"
                  autocomplete="current-password"
                  [type]="passwordVisible() ? 'text' : 'password'"
                  [attr.aria-invalid]="showError('password')"
                  aria-describedby="password-error"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-slate-400 hover:text-slate-600"
                  [attr.aria-label]="passwordVisible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  (click)="passwordVisible.set(!passwordVisible())"
                >
                  <app-icon [name]="passwordVisible() ? 'eye-off' : 'eye'" [size]="18" />
                </button>
              </div>
              @if (showError('password')) {
                <p id="password-error" class="mt-1.5 text-xs text-red-600">Introduce tu contraseña.</p>
              }
            </div>

            <button type="submit" class="btn-primary w-full" [disabled]="loading()">
              @if (loading()) {
                <app-icon name="loader-circle" [size]="18" class="animate-spin" />
                Entrando…
              } @else {
                Entrar
              }
            </button>
          </form>

          <section class="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-4" aria-labelledby="demo-title">
            <h2 id="demo-title" class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <app-icon name="info" [size]="14" /> Cuentas de demostración
            </h2>
            <div class="mt-3 grid gap-2">
              @for (account of demoAccounts; track account.email) {
                <button
                  type="button"
                  class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:border-brand-500 hover:bg-brand-50"
                  (click)="useDemo(account)"
                >
                  <span>
                    <span class="block font-medium text-slate-800">{{ account.label }}</span>
                    <span class="block text-xs text-slate-500">{{ account.hint }}</span>
                  </span>
                  <app-icon name="arrow-right" [size]="16" class="text-slate-400" />
                </button>
              }
            </div>
            <p class="mt-3 text-xs text-slate-500">Contraseña: <code class="font-mono text-slate-700">{{ demoPassword }}</code></p>
          </section>
        </div>
      </main>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly demoPassword = DEMO_PASSWORD;

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly sessionExpired = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.has('expired'))),
    { initialValue: false },
  );

  protected showError(control: 'email' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || field.dirty);
  }

  protected useDemo(account: DemoAccount): void {
    this.form.setValue({ email: account.email, password: DEMO_PASSWORD });
    this.submit();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(email.trim(), password).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'))),
      error: (err: unknown) => {
        this.error.set(toApiError(err));
        this.loading.set(false);
      },
    });
  }
}

/** Solo rutas internas: evita redirecciones abiertas (`//evil.com`, `https://...`). */
export function safeReturnUrl(candidate: string | null): string {
  return candidate && candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.startsWith('/login')
    ? candidate
    : '/courses';
}

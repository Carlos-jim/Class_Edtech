import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ANA_SESSION } from '../../../testing/session';
import { AuthService } from '../../core/auth/auth.service';
import { DEMO_PASSWORD, LoginPage, safeReturnUrl } from './login-page';

describe('LoginPage', () => {
  const login = vi.fn();

  function render(queryParams: Record<string, string> = {}) {
    login.mockReset();
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login } },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap(queryParams)), snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, router };
  }

  const type = (el: HTMLElement, selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('validates the form before calling the API', async () => {
    const { fixture, el } = render();

    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();

    expect(login).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Introduce un correo válido');
    expect(el.textContent).toContain('Introduce tu contraseña');
  });

  it('logs in and goes to the requested page', async () => {
    const { fixture, el, router } = render({ returnUrl: '/lessons/l2' });
    login.mockReturnValue(of(ANA_SESSION.student));

    type(el, '#email', ' ana.garcia@demo.edtech ');
    type(el, '#password', 'Demo1234!');
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();

    expect(login).toHaveBeenCalledWith('ana.garcia@demo.edtech', 'Demo1234!');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/lessons/l2');
  });

  it('demo account buttons log in with the seeded credentials', async () => {
    const { fixture, el } = render();
    login.mockReturnValue(of(ANA_SESSION.student));

    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('Bruno López'))!.click();
    await fixture.whenStable();

    expect(login).toHaveBeenCalledWith('bruno.lopez@demo.edtech', DEMO_PASSWORD);
  });

  it('shows the API error and re-enables the form', async () => {
    const { fixture, el } = render();
    login.mockReturnValue(
      throwError(() => ({ status: 401, code: 'INVALID_CREDENTIALS', detail: 'Correo o contraseña incorrectos' })),
    );

    type(el, '#email', 'ana.garcia@demo.edtech');
    type(el, '#password', 'mala');
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();

    expect(el.querySelector('[role=alert]')?.textContent).toContain('Correo o contraseña incorrectos');
    expect(el.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
  });

  it('explains when the session expired', async () => {
    const { fixture, el } = render({ expired: '1' });
    await fixture.whenStable();

    expect(el.textContent).toContain('Tu sesión ha caducado');
  });
});

describe('safeReturnUrl', () => {
  it('only allows internal routes (no open redirects)', () => {
    expect(safeReturnUrl('/lessons/abc')).toBe('/lessons/abc');
    expect(safeReturnUrl(null)).toBe('/courses');
    expect(safeReturnUrl('https://evil.example')).toBe('/courses');
    expect(safeReturnUrl('//evil.example')).toBe('/courses');
    expect(safeReturnUrl('/login?expired=1')).toBe('/courses');
  });
});

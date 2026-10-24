import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { seedSession } from '../../../testing/session';
import { authGuard, guestGuard } from './auth.guards';

describe('auth guards', () => {
  const state = { url: '/lessons/l2' } as RouterStateSnapshot;
  const route = {} as ActivatedRouteSnapshot;

  function run(guard: typeof authGuard) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    return TestBed.runInInjectionContext(() => guard(route, state));
  }

  beforeEach(() => sessionStorage.clear());

  it('authGuard sends anonymous users to login with returnUrl', () => {
    const result = run(authGuard) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Flessons%2Fl2');
  });

  it('authGuard lets authenticated students through', () => {
    seedSession();

    expect(run(authGuard)).toBe(true);
  });

  it('guestGuard redirects authenticated students to their courses', () => {
    seedSession();

    const result = run(guestGuard) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/courses');
  });

  it('guestGuard shows the login to anonymous users', () => {
    expect(run(guestGuard)).toBe(true);
  });
});

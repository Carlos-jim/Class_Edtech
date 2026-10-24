import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ANA_SESSION, seedSession } from '../../../testing/session';
import { AuthService, LOGIN_URL, SESSION_STORAGE_KEY } from './auth.service';

describe('AuthService', () => {
  let http: HttpTestingController;
  let router: Router;

  function setUp(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => http?.verify());

  it('logs in, stores the session and exposes the student', () => {
    const auth = setUp();
    let loggedIn = '';

    auth.login('ana.garcia@demo.edtech', 'Demo1234!').subscribe((student) => (loggedIn = student.displayName));
    const request = http.expectOne(LOGIN_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'ana.garcia@demo.edtech', password: 'Demo1234!' });
    request.flush({
      accessToken: 'jwt',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      student: ANA_SESSION.student,
    });

    expect(loggedIn).toBe('Ana García');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe('jwt');
    expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)!).token).toBe('jwt');
  });

  it('restores a valid session after a page reload', () => {
    seedSession();

    const auth = setUp();

    expect(auth.student()?.displayName).toBe('Ana García');
    expect(auth.token()).toBe(ANA_SESSION.token);
  });

  it('discards corrupted or expired stored sessions', () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, '{no-es-json');
    expect(setUp().isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    TestBed.resetTestingModule();
    seedSession({ ...ANA_SESSION, expiresAt: Date.now() - 1 });
    expect(setUp().isAuthenticated()).toBe(false);
  });

  it('drops the session when the token expires while the app is open', () => {
    seedSession({ ...ANA_SESSION, expiresAt: Date.now() + 50 });
    const auth = setUp();
    vi.spyOn(Date, 'now').mockReturnValue(ANA_SESSION.expiresAt + 1);

    expect(auth.token()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    vi.restoreAllMocks();
  });

  it('logout clears the session and goes to login', () => {
    seedSession();
    const auth = setUp();

    auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('sessionExpired returns to login remembering where the student was', () => {
    seedSession();
    const auth = setUp();

    auth.sessionExpired('/lessons/abc');

    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 1, returnUrl: '/lessons/abc' } });
  });
});

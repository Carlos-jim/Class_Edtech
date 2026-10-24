import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { seedSession } from '../../../testing/session';
import { ApiError, NETWORK_ERROR } from '../api/api-error';
import { authInterceptor, errorInterceptor } from './auth.interceptors';
import { AuthService, LOGIN_URL } from './auth.service';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    seedSession();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  it('adds the bearer token to API requests', () => {
    http.get('/api/courses').subscribe();

    expect(backend.expectOne('/api/courses').request.headers.get('Authorization')).toBe('Bearer token-ana');
  });

  it('never sends the token to the login endpoint or to third parties', () => {
    http.post(LOGIN_URL, {}).subscribe();
    http.get('https://evil.example/api/x').subscribe();

    expect(backend.expectOne(LOGIN_URL).request.headers.has('Authorization')).toBe(false);
    expect(backend.expectOne('https://evil.example/api/x').request.headers.has('Authorization')).toBe(false);
  });

  it('a 401 from the API expires the session and surfaces an ApiError', () => {
    const expired = vi.spyOn(auth, 'sessionExpired').mockImplementation(() => undefined);
    let received: ApiError | undefined;

    http.get('/api/courses').subscribe({ error: (e: ApiError) => (received = e) });
    backend.expectOne('/api/courses').flush(
      { code: 'UNAUTHENTICATED', detail: 'Autenticación requerida o token no válido' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(expired).toHaveBeenCalled();
    expect(received?.code).toBe('UNAUTHENTICATED');
  });

  it('a 401 from the login endpoint is just wrong credentials', () => {
    const expired = vi.spyOn(auth, 'sessionExpired').mockImplementation(() => undefined);
    let received: ApiError | undefined;

    http.post(LOGIN_URL, {}).subscribe({ error: (e: ApiError) => (received = e) });
    backend.expectOne(LOGIN_URL).flush(
      { code: 'INVALID_CREDENTIALS', detail: 'Correo o contraseña incorrectos' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(expired).not.toHaveBeenCalled();
    expect(received?.code).toBe('INVALID_CREDENTIALS');
  });

  it('a network failure becomes NETWORK_ERROR', () => {
    let received: ApiError | undefined;

    http.get('/api/courses').subscribe({ error: (e: ApiError) => (received = e) });
    backend.expectOne('/api/courses').error(new ProgressEvent('error'), { status: 0 });

    expect(received?.code).toBe(NETWORK_ERROR);
  });
});

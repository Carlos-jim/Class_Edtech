import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { CatalogApi, CourseSummary } from '../../core/api/catalog-api';
import { AuthService } from '../../core/auth/auth.service';
import { CoursesPage } from './courses-page';
import { signal } from '@angular/core';
import { ANA_SESSION } from '../../../testing/session';

const COURSE: CourseSummary = {
  id: 'c1',
  slug: 'fundamentos-apis-rest',
  title: 'Fundamentos de APIs REST',
  description: 'Aprende qué es una API REST',
  lessonCount: 2,
  totalMinutes: 22,
  firstLessonId: 'l1',
};

describe('CoursesPage', () => {
  const myCourses = vi.fn();

  function render() {
    TestBed.configureTestingModule({
      imports: [CoursesPage],
      providers: [
        provideRouter([]),
        { provide: CatalogApi, useValue: { myCourses } },
        { provide: AuthService, useValue: { student: signal(ANA_SESSION.student) } },
      ],
    });
    const fixture = TestBed.createComponent(CoursesPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => myCourses.mockReset());

  it('shows skeletons while loading', () => {
    myCourses.mockReturnValue(new Subject());

    const { el } = render();

    expect(el.querySelector('[data-testid=courses-loading]')).not.toBeNull();
  });

  it('greets the student and lists the enrolled courses with a link to the first lesson', async () => {
    myCourses.mockReturnValue(of([COURSE]));

    const { fixture, el } = render();
    await fixture.whenStable();

    expect(el.querySelector('h1')?.textContent).toContain('Hola, Ana');
    expect(el.textContent).toContain('Fundamentos de APIs REST');
    expect(el.textContent).toContain('2 lecciones');
    expect(el.textContent).toContain('22 min');
    expect(el.querySelector('a[href="/lessons/l1"]')).not.toBeNull();
  });

  it('shows an empty state to students without enrollments', async () => {
    myCourses.mockReturnValue(of([]));

    const { fixture, el } = render();
    await fixture.whenStable();

    expect(el.querySelector('[data-testid=courses-empty]')?.textContent).toContain('Aún no tienes cursos asignados');
  });

  it('shows the error and retries on demand', async () => {
    myCourses.mockReturnValueOnce(
      throwError(() => ({ status: 0, code: 'NETWORK_ERROR', detail: 'No hay conexión con el servidor.' })),
    );
    myCourses.mockReturnValueOnce(of([COURSE]));

    const { fixture, el } = render();
    await fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('No hay conexión con el servidor.');

    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'))!.click();
    await fixture.whenStable();

    expect(myCourses).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Fundamentos de APIs REST');
  });
});

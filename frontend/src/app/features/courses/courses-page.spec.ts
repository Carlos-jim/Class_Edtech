import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { CatalogApi, CourseDetail, CourseSummary } from '../../core/api/catalog-api';
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

const DETAIL: CourseDetail = {
  id: 'c1',
  slug: 'fundamentos-apis-rest',
  title: 'Fundamentos de APIs REST',
  description: '',
  lessons: [
    { id: 'l1', position: 1, title: 'Introducción a las APIs REST', summary: '', estimatedMinutes: 10 },
    { id: 'l2', position: 2, title: 'Métodos HTTP', summary: '', estimatedMinutes: 12 },
  ],
};

describe('CoursesPage', () => {
  const myCourses = vi.fn();
  const course = vi.fn();

  function render() {
    TestBed.configureTestingModule({
      imports: [CoursesPage],
      providers: [
        provideRouter([]),
        { provide: CatalogApi, useValue: { myCourses, course } },
        { provide: AuthService, useValue: { student: signal(ANA_SESSION.student) } },
      ],
    });
    const fixture = TestBed.createComponent(CoursesPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    myCourses.mockReset();
    course.mockReset().mockReturnValue(of(DETAIL));
  });

  it('shows skeletons while loading', () => {
    myCourses.mockReturnValue(new Subject());

    const { el } = render();

    expect(el.querySelector('[data-testid=courses-loading]')).not.toBeNull();
  });

  it('greets the student and lists the enrolled courses with a link to the first lesson', async () => {
    myCourses.mockReturnValue(of([COURSE]));

    const { fixture, el } = render();
    await fixture.whenStable();

    expect(el.querySelector('h1')?.textContent).toContain('Mis cursos');
    expect(el.textContent).toContain('Hola, Ana');
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

  it('shows the syllabus of the course as a numbered list linking to each lesson', async () => {
    myCourses.mockReturnValue(of([COURSE]));

    const { fixture, el } = render();
    await fixture.whenStable();

    const syllabus = el.querySelector('[data-testid=courses-syllabus]')!;
    expect(course).toHaveBeenCalledWith('c1');
    expect(syllabus.textContent).toContain('01');
    expect(syllabus.textContent).toContain('Métodos HTTP');
    expect(syllabus.querySelector('a[href="/lessons/l2"]')).not.toBeNull();
  });

  it('a syllabus failure does not break the course list', async () => {
    myCourses.mockReturnValue(of([COURSE]));
    course.mockReturnValue(throwError(() => ({ status: 500, code: 'INTERNAL_ERROR', detail: 'x' })));

    const { fixture, el } = render();
    await fixture.whenStable();

    expect(el.querySelector('[data-testid=courses-syllabus]')).toBeNull();
    expect(el.textContent).toContain('Fundamentos de APIs REST');
  });

  it('with several courses, the search filters by title or description ignoring accents', async () => {
    myCourses.mockReturnValue(
      of([COURSE, { ...COURSE, id: 'c2', title: 'Diseño de interfaces', description: 'Componentes', firstLessonId: 'x' }]),
    );
    const { fixture, el } = render();
    await fixture.whenStable();

    const search = el.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = 'diseno';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(el.querySelectorAll('app-course-card')).toHaveLength(1);
    expect(el.textContent).toContain('Diseño de interfaces');

    search.value = 'química';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Ningún curso coincide');
  });

  it('with a single course there is no search box', async () => {
    myCourses.mockReturnValue(of([COURSE]));

    const { fixture, el } = render();
    await fixture.whenStable();

    expect(el.querySelector('input[type=search]')).toBeNull();
  });
});

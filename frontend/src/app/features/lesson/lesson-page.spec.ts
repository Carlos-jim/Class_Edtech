import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { askResponse, studentMessage, tutorMessage } from '../../../testing/chat';
import { CatalogApi, CourseDetail, LessonDetail } from '../../core/api/catalog-api';
import { TutorApi } from '../../core/api/tutor-api';
import { LessonPage } from './lesson-page';

const LESSON: LessonDetail = {
  id: 'l2',
  courseId: 'c1',
  courseTitle: 'Fundamentos de APIs REST',
  position: 2,
  title: 'Métodos HTTP',
  summary: 'Para qué sirve cada método',
  estimatedMinutes: 12,
  content: '## POST — Crear\n\nSirve para **crear** recursos. <script>alert(1)</script>',
  previousLessonId: 'l1',
  nextLessonId: null,
};

const COURSE: CourseDetail = {
  id: 'c1',
  slug: 'apis',
  title: 'Fundamentos de APIs REST',
  description: '',
  lessons: [
    { id: 'l1', position: 1, title: 'Introducción', summary: '', estimatedMinutes: 10 },
    { id: 'l2', position: 2, title: 'Métodos HTTP', summary: '', estimatedMinutes: 12 },
  ],
};

describe('LessonPage', () => {
  const lesson = vi.fn();
  const course = vi.fn();
  const history = vi.fn();
  const ask = vi.fn();

  async function render() {
    TestBed.configureTestingModule({
      imports: [LessonPage],
      providers: [
        provideRouter([]),
        { provide: CatalogApi, useValue: { lesson, course } },
        { provide: TutorApi, useValue: { history, ask } },
      ],
    });
    const fixture = TestBed.createComponent(LessonPage);
    fixture.componentRef.setInput('lessonId', 'l2');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    [lesson, course, history, ask].forEach((fn) => fn.mockReset());
    lesson.mockReturnValue(of(LESSON));
    course.mockReturnValue(of(COURSE));
    history.mockReturnValue(of([]));
  });

  it('shows syllabus, sanitized lesson content and the tutor with suggestions', async () => {
    const { el } = await render();

    expect(el.querySelector('h1')?.textContent).toContain('Métodos HTTP');
    expect(el.querySelector('[aria-current=page]')?.textContent).toContain('Métodos HTTP');
    const body = el.querySelector('[data-testid=lesson-body]')!;
    expect(body.innerHTML).toContain('<strong>crear</strong>');
    expect(body.querySelector('script')).toBeNull();
    expect(el.querySelector('[data-testid=tutor-empty]')?.textContent).toContain('Explícame: POST');
    expect(history).toHaveBeenCalledWith('l2');
  });

  it('restores the previous conversation', async () => {
    history.mockReturnValue(of([studentMessage('¿Qué es GET?'), tutorMessage('No está en la lección.', false)]));

    const { el } = await render();

    expect(el.querySelector('[data-testid=student-message]')?.textContent).toContain('¿Qué es GET?');
    expect(el.textContent).toContain('Sin información suficiente en la lección');
  });

  it('asking a suggested question sends it and shows the grounded answer', async () => {
    ask.mockReturnValue(of(askResponse('Explícame: POST', 'POST sirve para crear recursos.')));
    const { fixture, el } = await render();

    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Explícame: POST'))!.click();
    await fixture.whenStable();

    expect(ask).toHaveBeenCalledWith('l2', 'Explícame: POST', 'TEXT');
    expect(el.querySelector('[data-testid=tutor-message]')?.textContent).toContain('POST sirve para crear recursos.');
    expect(el.textContent).toContain('Basado en la lección');
  });

  it('renders tutor answers as text, never as HTML', async () => {
    history.mockReturnValue(of([tutorMessage('<img src=x onerror=alert(1)>Hola')]));

    const { el } = await render();

    const bubble = el.querySelector('[data-testid=tutor-message]')!;
    expect(bubble.querySelector('img')).toBeNull();
    expect(bubble.textContent).toContain('<img src=x onerror=alert(1)>Hola');
  });

  it('Enter sends the question and Shift+Enter does not', async () => {
    ask.mockReturnValue(of(askResponse('Hola', 'Respuesta')));
    const { fixture, el } = await render();
    const textarea = el.querySelector<HTMLTextAreaElement>('#tutor-question')!;

    textarea.value = 'Hola';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(ask).not.toHaveBeenCalled();

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(ask).toHaveBeenCalledWith('l2', 'Hola', 'TEXT');
  });

  it('a lesson without access shows the access denied screen and never loads messages', async () => {
    lesson.mockReturnValue(throwError(() => ({ status: 404, code: 'NOT_FOUND', detail: 'x' })));

    const { el } = await render();

    expect(el.querySelector('[data-testid=lesson-denied]')?.textContent).toContain('No tienes acceso a esta lección');
    expect(history).not.toHaveBeenCalled();
  });

  it('other errors offer a retry', async () => {
    lesson.mockReturnValueOnce(throwError(() => ({ status: 0, code: 'NETWORK_ERROR', detail: 'Sin conexión' })));
    const { fixture, el } = await render();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Sin conexión');

    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('h1')?.textContent).toContain('Métodos HTTP');
  });
});

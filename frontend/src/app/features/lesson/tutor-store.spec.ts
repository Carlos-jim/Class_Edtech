import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { askResponse, studentMessage, tutorMessage } from '../../../testing/chat';
import { AskResponse, TutorApi } from '../../core/api/tutor-api';
import { TutorStore } from './tutor-store';

describe('TutorStore', () => {
  const history = vi.fn();
  const ask = vi.fn();
  let store: TutorStore;

  beforeEach(() => {
    history.mockReset().mockReturnValue(of([]));
    ask.mockReset();
    TestBed.configureTestingModule({ providers: [TutorStore, { provide: TutorApi, useValue: { history, ask } }] });
    store = TestBed.inject(TutorStore);
  });

  it('loads the previous conversation of the lesson', () => {
    history.mockReturnValue(of([studentMessage('¿Qué es GET?'), tutorMessage('Lee recursos.')]));

    store.load('l2');

    expect(history).toHaveBeenCalledWith('l2');
    expect(store.messages()).toHaveLength(2);
    expect(store.phase()).toBe('idle');
  });

  it('reports a history failure with a retry that reloads', () => {
    history.mockReturnValueOnce(throwError(() => ({ status: 500, code: 'INTERNAL_ERROR', detail: 'x' })));

    store.load('l2');
    expect(store.error()).toMatchObject({ kind: 'history', message: 'No se pudo cargar tu conversación anterior.' });

    store.retry();
    expect(history).toHaveBeenCalledTimes(2);
    expect(store.error()).toBeNull();
  });

  it('sends the question, shows it as pending and appends question + answer', () => {
    const response = new Subject<AskResponse>();
    ask.mockReturnValue(response);
    store.load('l2');

    store.updateDraft('  ¿Para qué sirve POST?  ');
    store.send();

    expect(ask).toHaveBeenCalledWith('l2', '¿Para qué sirve POST?', 'TEXT');
    expect(store.phase()).toBe('sending');
    expect(store.statusText()).toBe('El tutor está pensando…');
    expect(store.pending()?.content).toBe('¿Para qué sirve POST?');
    expect(store.draft()).toBe('');

    response.next(askResponse('¿Para qué sirve POST?', 'Para crear recursos.'));

    expect(store.phase()).toBe('idle');
    expect(store.pending()).toBeNull();
    expect(store.messages().map((m) => m.role)).toEqual(['STUDENT', 'TUTOR']);
  });

  it('on failure gives the question back to the composer so nothing is lost', () => {
    ask.mockReturnValueOnce(
      throwError(() => ({ status: 503, code: 'AI_UNAVAILABLE', detail: 'El tutor no está disponible en este momento.' })),
    );
    store.load('l2');
    store.updateDraft('¿Qué es PUT?');

    store.send();

    expect(store.phase()).toBe('idle');
    expect(store.draft()).toBe('¿Qué es PUT?');
    expect(store.messages()).toHaveLength(0);
    expect(store.error()).toMatchObject({ kind: 'send', code: 'AI_UNAVAILABLE' });

    ask.mockReturnValueOnce(of(askResponse('¿Qué es PUT?', 'Reemplaza un recurso.')));
    store.retry();

    expect(ask).toHaveBeenCalledTimes(2);
    expect(store.messages()).toHaveLength(2);
    expect(store.error()).toBeNull();
  });

  it('explains network errors and reassures that the question is kept', () => {
    ask.mockReturnValue(throwError(() => ({ status: 0, code: 'NETWORK_ERROR', detail: 'x' })));
    store.load('l2');
    store.updateDraft('Hola');

    store.send();

    expect(store.error()?.message).toContain('Tu pregunta no se ha perdido');
  });

  it('cannot send empty, too long or concurrent questions', () => {
    ask.mockReturnValue(new Subject());
    store.load('l2');

    store.updateDraft('   ');
    expect(store.canSend()).toBe(false);

    store.updateDraft('a'.repeat(2001));
    expect(store.canSend()).toBe(false);

    store.updateDraft('Primera');
    store.send();
    store.updateDraft('Segunda');
    store.send();

    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('only allows valid phase transitions', () => {
    store.load('l2');

    expect(store.transition('reviewing')).toBe(false);
    expect(store.phase()).toBe('idle');
    expect(store.transition('recording')).toBe(true);
    expect(store.transition('sending')).toBe(false);
    expect(store.transition('transcribing')).toBe(true);
    expect(store.transition('reviewing')).toBe(true);
  });
});

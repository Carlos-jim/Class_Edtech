import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { askResponse, tutorMessage } from '../../../testing/chat';
import { TranscriptionApi } from '../../core/api/transcription-api';
import { TutorApi } from '../../core/api/tutor-api';
import { AudioRecorder, MicrophoneError } from '../../core/voice/audio-recorder';
import { SpeechPlayer } from '../../core/voice/speech-player';
import { TutorStore } from './tutor-store';

describe('TutorStore · voz', () => {
  const audio = new Blob(['voz'], { type: 'audio/webm' });
  const recorder = {
    isSupported: true,
    elapsedSeconds: signal(0),
    level: signal(0),
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
  };
  const transcribe = vi.fn();
  const ask = vi.fn();
  const speech = {
    isSupported: true,
    speakingId: signal<string | null>(null),
    failure: signal<{ id: string; text: string } | null>(null),
    speak: vi.fn(),
    stop: vi.fn(),
    toggle: vi.fn(),
  };
  let store: TutorStore;

  beforeEach(() => {
    [recorder.start, recorder.stop, recorder.cancel, transcribe, ask, speech.speak, speech.stop, speech.toggle].forEach((fn) => fn.mockReset());
    speech.failure.set(null);
    recorder.start.mockResolvedValue(undefined);
    recorder.stop.mockResolvedValue(audio);
    TestBed.configureTestingModule({
      providers: [
        TutorStore,
        { provide: TutorApi, useValue: { history: () => of([]), ask } },
        { provide: TranscriptionApi, useValue: { transcribe } },
        { provide: AudioRecorder, useValue: recorder },
        { provide: SpeechPlayer, useValue: speech },
      ],
    });
    store = TestBed.inject(TutorStore);
    store.load('l2');
  });

  async function recordAndStop(): Promise<void> {
    await store.startRecording();
    await store.stopRecording();
  }

  it('records, transcribes and lets the student review the text before sending', async () => {
    transcribe.mockReturnValue(of({ text: '¿Para qué sirve POST?' }));

    await store.startRecording();
    expect(speech.stop).toHaveBeenCalled(); // el altavoz no se graba a sí mismo
    expect(store.phase()).toBe('recording');
    expect(store.statusText()).toContain('Escuchando');

    await store.stopRecording();

    expect(transcribe).toHaveBeenCalledWith(audio);
    expect(store.phase()).toBe('reviewing');
    expect(store.draft()).toBe('¿Para qué sirve POST?');
    expect(store.draftMode()).toBe('VOICE');
    expect(ask).not.toHaveBeenCalled();
  });

  it('sends the reviewed (and edited) transcript as a voice question and reads the answer aloud', async () => {
    transcribe.mockReturnValue(of({ text: '¿Para qué sirve post?' }));
    ask.mockReturnValue(of(askResponse('¿Para qué sirve POST?', 'POST crea recursos.')));
    await recordAndStop();

    store.updateDraft('¿Para qué sirve POST?');
    store.send();

    expect(ask).toHaveBeenCalledWith('l2', '¿Para qué sirve POST?', 'VOICE');
    expect(speech.speak).toHaveBeenCalledWith('a-POST crea recursos.', 'POST crea recursos.');
  });

  it('text questions are not read aloud automatically', () => {
    ask.mockReturnValue(of(askResponse('Hola', 'Respuesta')));

    store.updateDraft('Hola');
    store.send();

    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('microphone problems explain what happened and offer typing instead', async () => {
    recorder.start.mockRejectedValue(new MicrophoneError('permission-denied'));

    await store.startRecording();

    expect(store.phase()).toBe('idle');
    expect(store.error()).toMatchObject({ kind: 'microphone', actionLabel: 'Escribir en su lugar' });
    expect(store.error()?.message).toContain('permiso para usar el micrófono');
    expect(store.requestingMicrophone()).toBe(false);
  });

  it('when no speech is detected the student is asked to record again', async () => {
    transcribe.mockReturnValue(
      throwError(() => ({ status: 422, code: 'NO_SPEECH_DETECTED', detail: 'No se ha detectado voz en la grabación.' })),
    );
    await recordAndStop();

    expect(store.phase()).toBe('idle');
    expect(store.error()).toMatchObject({ kind: 'transcription', actionLabel: 'Grabar de nuevo' });

    recorder.start.mockClear();
    store.retry();
    expect(recorder.start).toHaveBeenCalled();
  });

  it('when the transcription service fails the same recording is retried without recording again', async () => {
    transcribe.mockReturnValueOnce(
      throwError(() => ({ status: 503, code: 'TRANSCRIPTION_UNAVAILABLE', detail: 'No se pudo transcribir el audio.' })),
    );
    await recordAndStop();
    expect(store.error()).toMatchObject({ kind: 'transcription', actionLabel: 'Reintentar' });

    transcribe.mockReturnValueOnce(of({ text: '¿Qué es REST?' }));
    recorder.start.mockClear();
    store.retry();

    expect(recorder.start).not.toHaveBeenCalled();
    expect(transcribe).toHaveBeenLastCalledWith(audio);
    expect(store.phase()).toBe('reviewing');
    expect(store.draft()).toBe('¿Qué es REST?');
  });

  it('cancelling a recording discards it and goes back to the previous state', async () => {
    await store.startRecording();

    store.cancelRecording();

    expect(recorder.cancel).toHaveBeenCalled();
    expect(store.phase()).toBe('idle');
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('clearing the reviewed transcript returns to idle and to text mode', async () => {
    transcribe.mockReturnValue(of({ text: 'Hola' }));
    await recordAndStop();

    store.updateDraft('');

    expect(store.phase()).toBe('idle');
    expect(store.draftMode()).toBe('TEXT');
  });

  it('cannot record while the tutor is answering', () => {
    ask.mockReturnValue(of());
    store.updateDraft('Hola');
    store.send();

    expect(store.canRecord()).toBe(false);
  });

  it('warns when the answer cannot be read aloud and retries the same answer', () => {
    speech.failure.set({ id: 'a1', text: 'POST crea recursos.' });
    TestBed.tick();

    expect(store.error()).toMatchObject({ kind: 'speech', actionLabel: 'Reintentar' });

    store.retry();

    expect(store.error()).toBeNull();
    expect(speech.speak).toHaveBeenCalledWith('a1', 'POST crea recursos.');
  });

  describe('without speech synthesis in the browser', () => {
    beforeEach(() => {
      speech.isSupported = false;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          TutorStore,
          { provide: TutorApi, useValue: { history: () => of([]), ask } },
          { provide: TranscriptionApi, useValue: { transcribe } },
          { provide: AudioRecorder, useValue: recorder },
          { provide: SpeechPlayer, useValue: speech },
        ],
      });
      store = TestBed.inject(TutorStore);
      store.load('l2');
    });

    afterEach(() => {
      speech.isSupported = true;
    });

    it('explains why the answer cannot be listened to', () => {
      store.toggleSpeech(tutorMessage('POST crea recursos.'));

      expect(store.error()).toMatchObject({ kind: 'speech', code: 'SPEECH_UNSUPPORTED', actionLabel: 'Entendido' });
      expect(speech.toggle).not.toHaveBeenCalled();
    });

    it('warns instead of staying silent after a voice question', async () => {
      transcribe.mockReturnValue(of({ text: '¿Para qué sirve POST?' }));
      ask.mockReturnValue(of(askResponse('¿Para qué sirve POST?', 'POST crea recursos.')));
      await recordAndStop();
      store.send();

      expect(speech.speak).not.toHaveBeenCalled();
      expect(store.error()).toMatchObject({ code: 'SPEECH_UNSUPPORTED' });
    });
  });
});

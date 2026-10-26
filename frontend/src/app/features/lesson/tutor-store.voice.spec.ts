import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { askResponse, tutorMessage } from '../../../testing/chat';
import { TranscriptionApi } from '../../core/api/transcription-api';
import { TutorApi } from '../../core/api/tutor-api';
import { AnswerAudioPlayer } from '../../core/voice/answer-audio-player';
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
    canSpeakSpanish: vi.fn(() => true),
    speakingId: signal<string | null>(null),
    failure: signal<{ id: string; text: string } | null>(null),
    speak: vi.fn(),
    stop: vi.fn(),
  };
  /** Audio generado en el servidor (Piper): alternativa cuando el navegador no tiene voces en español. */
  const serverVoice = {
    speakingId: signal<string | null>(null),
    loading: signal(false),
    failure: signal<{ id: string; code: string } | null>(null),
    play: vi.fn(),
    stop: vi.fn(),
  };
  let store: TutorStore;

  beforeEach(() => {
    [recorder.start, recorder.stop, recorder.cancel, transcribe, ask, speech.speak, speech.stop, serverVoice.play, serverVoice.stop].forEach(
      (fn) => fn.mockReset(),
    );
    speech.canSpeakSpanish.mockReturnValue(true);
    speech.failure.set(null);
    serverVoice.failure.set(null);
    recorder.start.mockResolvedValue(undefined);
    recorder.stop.mockResolvedValue(audio);
    TestBed.configureTestingModule({
      providers: [
        TutorStore,
        { provide: TutorApi, useValue: { history: () => of([]), ask } },
        { provide: TranscriptionApi, useValue: { transcribe } },
        { provide: AudioRecorder, useValue: recorder },
        { provide: SpeechPlayer, useValue: speech },
        { provide: AnswerAudioPlayer, useValue: serverVoice },
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

    expect(transcribe).toHaveBeenCalledWith(audio, 'l2'); // con la lección como contexto
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
    expect(transcribe).toHaveBeenLastCalledWith(audio, 'l2');
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

  it('falls back to the server audio when the browser voice stays silent', () => {
    speech.failure.set({ id: 'a1', text: 'POST crea recursos.' });
    TestBed.tick();

    expect(serverVoice.play).toHaveBeenCalledWith('l2', 'a1');
    expect(store.error()).toBeNull();
  });

  it('warns when the answer cannot be read aloud at all and retries the same answer', () => {
    serverVoice.failure.set({ id: 'a1', code: 'SPEECH_SYNTHESIS_UNAVAILABLE' });
    TestBed.tick();

    expect(store.error()).toMatchObject({ kind: 'speech', actionLabel: 'Reintentar' });

    store.retry();

    expect(store.error()).toBeNull();
    expect(serverVoice.play).toHaveBeenCalledWith('l2', 'a1');
  });

  it('listening again to the answer being read stops it', () => {
    const answer = tutorMessage('POST crea recursos.');
    store.toggleSpeech(answer);
    speech.speakingId.set(answer.id);

    store.toggleSpeech(answer);

    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.stop).toHaveBeenCalled();
    expect(serverVoice.stop).toHaveBeenCalled();
    speech.speakingId.set(null);
  });

  describe('without a Spanish voice in the browser (Linux without voices, Opera...)', () => {
    beforeEach(() => speech.canSpeakSpanish.mockReturnValue(false));

    it('"Escuchar" plays the audio generated by the server', () => {
      const answer = tutorMessage('POST crea recursos.');

      store.toggleSpeech(answer);

      expect(serverVoice.play).toHaveBeenCalledWith('l2', answer.id);
      expect(speech.speak).not.toHaveBeenCalled();
      expect(store.error()).toBeNull();
    });

    it('voice answers are read aloud with the server audio', async () => {
      transcribe.mockReturnValue(of({ text: '¿Para qué sirve POST?' }));
      ask.mockReturnValue(of(askResponse('¿Para qué sirve POST?', 'POST crea recursos.')));
      await recordAndStop();
      store.send();

      expect(serverVoice.play).toHaveBeenCalledWith('l2', 'a-POST crea recursos.');
    });

    it('shows that the audio is being prepared', () => {
      serverVoice.speakingId.set('a1');
      serverVoice.loading.set(true);

      expect(store.speakingId()).toBe('a1');
      expect(store.statusText()).toContain('Preparando el audio');

      serverVoice.loading.set(false);
      serverVoice.speakingId.set(null);
    });
  });
});

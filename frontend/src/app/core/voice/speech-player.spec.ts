import { TestBed } from '@angular/core/testing';
import { SPEECH_START_TIMEOUT_MS, SpeechPlayer, splitIntoSentences } from './speech-player';

class FakeUtterance {
  lang = '';
  rate = 1;
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(readonly text: string) {}
}

describe('SpeechPlayer', () => {
  let spoken: FakeUtterance[];
  const synth = {
    speak: vi.fn((utterance: FakeUtterance) => spoken.push(utterance)),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [{ lang: 'en-US' }, { lang: 'es-MX', name: 'Paulina' }],
  };

  beforeEach(() => {
    spoken = [];
    synth.speak.mockClear();
    synth.cancel.mockClear();
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reads the answer in Spanish, sentence by sentence, and tracks which message is playing', () => {
    const player = TestBed.inject(SpeechPlayer);

    player.speak('m1', 'POST crea recursos. No es idempotente.');

    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken.map((u) => u.lang)).toEqual(['es-MX']);
    expect(player.speakingId()).toBe('m1');

    spoken.at(-1)!.onend!();
    expect(player.speakingId()).toBeNull();
  });

  it('toggle stops the message that is playing', () => {
    const player = TestBed.inject(SpeechPlayer);

    player.toggle('m1', 'Hola.');
    player.toggle('m1', 'Hola.');

    expect(player.speakingId()).toBeNull();
    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });

  it('reports a failure when nothing starts playing (browser without voices)', () => {
    vi.useFakeTimers();
    const player = TestBed.inject(SpeechPlayer);

    player.speak('m1', 'Hola.');
    vi.advanceTimersByTime(SPEECH_START_TIMEOUT_MS);

    expect(player.speakingId()).toBeNull();
    expect(player.failure()).toEqual({ id: 'm1', text: 'Hola.' });
    vi.useRealTimers();
  });

  it('does not report a failure once playback has started or when it is stopped on purpose', () => {
    vi.useFakeTimers();
    const player = TestBed.inject(SpeechPlayer);

    player.speak('m1', 'Hola.');
    spoken[0].onstart!();
    vi.advanceTimersByTime(SPEECH_START_TIMEOUT_MS);
    spoken[0].onerror!({ error: 'interrupted' });

    expect(player.failure()).toBeNull();
    vi.useRealTimers();
  });

  it('reports a failure when the speech engine errors', () => {
    const player = TestBed.inject(SpeechPlayer);

    player.speak('m1', 'Hola.');
    spoken[0].onerror!({ error: 'synthesis-unavailable' });

    expect(player.failure()?.id).toBe('m1');
    expect(player.speakingId()).toBeNull();
  });

  it('does nothing when the browser has no speech synthesis', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('speechSynthesis', undefined);
    const player = TestBed.inject(SpeechPlayer);

    expect(player.speak('m1', 'Hola')).toBe(false);
  });
});

describe('splitIntoSentences', () => {
  it('groups short sentences and splits long texts so Chrome does not cut them off', () => {
    const long = 'Primera frase bastante larga para el test. '.repeat(10);

    const parts = splitIntoSentences(long, 100);

    expect(parts.length).toBeGreaterThan(3);
    expect(parts.every((part) => part.length <= 100)).toBe(true);
  });

  it('drops list bullets so they are not read aloud', () => {
    expect(splitIntoSentences('Métodos:\n• GET lee.\n• POST crea.')).toEqual(['Métodos: GET lee. POST crea.']);
  });
});

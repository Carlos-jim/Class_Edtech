import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { TutorApi } from '../api/tutor-api';
import { AnswerAudioPlayer } from './answer-audio-player';

class FakeAudio {
  static last: FakeAudio;
  static playResult: Promise<void> = Promise.resolve();
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  constructor(readonly src: string) {
    FakeAudio.last = this;
  }
  play(): Promise<void> {
    return FakeAudio.playResult;
  }
}

describe('AnswerAudioPlayer', () => {
  const answerAudio = vi.fn();
  let player: AnswerAudioPlayer;

  beforeEach(() => {
    answerAudio.mockReset();
    FakeAudio.playResult = Promise.resolve();
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:audio'), revokeObjectURL: vi.fn() });
    TestBed.configureTestingModule({ providers: [{ provide: TutorApi, useValue: { answerAudio } }] });
    player = TestBed.inject(AnswerAudioPlayer);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('downloads the answer audio, plays it and frees it when it ends', () => {
    const response = new Subject<Blob>();
    answerAudio.mockReturnValue(response);

    player.play('l2', 'a1');
    expect(answerAudio).toHaveBeenCalledWith('l2', 'a1');
    expect(player.speakingId()).toBe('a1');
    expect(player.loading()).toBe(true);

    response.next(new Blob(['RIFF'], { type: 'audio/wav' }));
    expect(player.loading()).toBe(false);
    expect(FakeAudio.last.src).toBe('blob:audio');

    FakeAudio.last.onended!();
    expect(player.speakingId()).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio');
  });

  it('stop cancels the download or the playback', () => {
    answerAudio.mockReturnValue(of(new Blob(['RIFF'])));
    player.play('l2', 'a1');

    player.stop();

    expect(FakeAudio.last.pause).toHaveBeenCalled();
    expect(player.speakingId()).toBeNull();
    expect(player.failure()).toBeNull();
  });

  it('reports a failure when the server cannot generate the audio', () => {
    answerAudio.mockReturnValue(throwError(() => ({ status: 503, code: 'SPEECH_SYNTHESIS_UNAVAILABLE', detail: 'x' })));

    player.play('l2', 'a1');

    expect(player.failure()).toEqual({ id: 'a1', code: 'SPEECH_SYNTHESIS_UNAVAILABLE' });
    expect(player.speakingId()).toBeNull();
  });

  it('a blocked autoplay is not an error: the student can press "Escuchar"', async () => {
    FakeAudio.playResult = Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    answerAudio.mockReturnValue(of(new Blob(['RIFF'])));

    player.play('l2', 'a1');
    await Promise.resolve();
    await Promise.resolve();

    expect(player.speakingId()).toBeNull();
    expect(player.failure()).toBeNull();
  });
});

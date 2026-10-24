import { TestBed } from '@angular/core/testing';
import { AudioRecorder, MicrophoneError, mapGetUserMediaError } from './audio-recorder';

describe('AudioRecorder', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps browser errors to actionable kinds', () => {
    expect(mapGetUserMediaError(new DOMException('x', 'NotAllowedError'))).toBe('permission-denied');
    expect(mapGetUserMediaError(new DOMException('x', 'NotFoundError'))).toBe('no-microphone');
    expect(mapGetUserMediaError(new DOMException('x', 'NotReadableError'))).toBe('busy');
    expect(mapGetUserMediaError(new Error('x'))).toBe('unknown');
  });

  it('reports unsupported browsers', async () => {
    vi.stubGlobal('MediaRecorder', undefined);

    await expect(TestBed.inject(AudioRecorder).start()).rejects.toMatchObject({ kind: 'unsupported' });
  });

  it('reports a denied permission', async () => {
    vi.stubGlobal('MediaRecorder', class {});
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: () => Promise.reject(new DOMException('x', 'NotAllowedError')) },
    });

    const error = await TestBed.inject(AudioRecorder).start().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MicrophoneError);
    expect((error as MicrophoneError).kind).toBe('permission-denied');
  });

  it('records with a supported format and returns the audio on stop, releasing the microphone', async () => {
    const stopTrack = vi.fn();
    class FakeMediaRecorder {
      static isTypeSupported = (type: string) => type === 'audio/mp4';
      state = 'inactive';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: unknown, readonly options?: { mimeType: string }) {}
      get mimeType() {
        return this.options?.mimeType ?? '';
      }
      start() {
        this.state = 'recording';
        this.ondataavailable?.({ data: new Blob(['abc'], { type: 'audio/mp4' }) });
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop: stopTrack }] }) },
    });
    const recorder = TestBed.inject(AudioRecorder);

    await recorder.start();
    expect(recorder.isRecording).toBe(true);
    const audio = await recorder.stop();

    expect(audio.type).toBe('audio/mp4');
    expect(audio.size).toBe(3);
    expect(stopTrack).toHaveBeenCalled();
  });
});

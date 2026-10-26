import { Injectable, signal } from '@angular/core';
import { toWav } from './wav-encoder';

export type MicrophoneErrorKind =
  | 'unsupported'
  | 'insecure-context'
  | 'permission-denied'
  | 'no-microphone'
  | 'busy'
  | 'unknown';

export class MicrophoneError extends Error {
  constructor(readonly kind: MicrophoneErrorKind) {
    super(`Micrófono no disponible: ${kind}`);
  }
}

export interface RecordingOptions {
  /** Se invoca al alcanzar la duración máxima: el llamador debe detener la grabación. */
  readonly onLimitReached?: () => void;
}

/** Duración máxima de una pregunta. ~60 s de Opus a 32 kbps ≈ 240 KB, muy por debajo del límite de 5 MB del backend. */
export const MAX_RECORDING_SECONDS = 60;

/** Formatos preferidos en orden: webm/opus (Chrome, Firefox, Edge), mp4 (Safari), ogg. */
const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/**
 * Adaptador sobre MediaRecorder (patrón Adapter): oculta las diferencias entre navegadores, limita la duración,
 * expone el tiempo y el nivel de audio como signals y traduce los errores a {@link MicrophoneErrorKind}.
 */
@Injectable({ providedIn: 'root' })
export class AudioRecorder {
  readonly elapsedSeconds = signal(0);
  /** Nivel de entrada 0..1 para la animación del micrófono. */
  readonly level = signal(0);

  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private audioContext?: AudioContext;
  private animationFrame?: number;

  get isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  get isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  async start(options: RecordingOptions = {}): Promise<void> {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      throw new MicrophoneError('insecure-context');
    }
    if (!this.isSupported) {
      throw new MicrophoneError('unsupported');
    }
    this.cleanUp();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      throw new MicrophoneError(mapGetUserMediaError(error));
    }

    const mimeType = PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type));
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.recorder.start(250);

    this.elapsedSeconds.set(0);
    this.timer = setInterval(() => {
      this.elapsedSeconds.update((seconds) => seconds + 1);
      if (this.elapsedSeconds() >= MAX_RECORDING_SECONDS) {
        options.onLimitReached?.();
      }
    }, 1000);
    this.startLevelMeter(this.stream);
  }

  /** Detiene la grabación y devuelve el audio en WAV 16 kHz (o el original si el navegador no puede convertirlo). */
  stop(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      this.cleanUp();
      return Promise.reject(new MicrophoneError('unknown'));
    }
    return new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const audio = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        this.cleanUp();
        void toWav(audio).then(resolve);
      };
      recorder.stop();
    });
  }

  /** Descarta la grabación en curso y libera el micrófono. */
  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.cleanUp();
  }

  private startLevelMeter(stream: MediaStream): void {
    if (typeof AudioContext === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      return;
    }
    try {
      this.audioContext = new AudioContext();
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      this.audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) {
          peak = Math.max(peak, Math.abs(sample - 128) / 128);
        }
        this.level.set(Math.min(1, peak * 2.5));
        this.animationFrame = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // El medidor es decorativo: si falla, se graba igualmente.
    }
  }

  private cleanUp(): void {
    clearInterval(this.timer);
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }
    void this.audioContext?.close().catch(() => undefined);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.timer = undefined;
    this.animationFrame = undefined;
    this.audioContext = undefined;
    this.stream = undefined;
    this.recorder = undefined;
    this.level.set(0);
  }
}

export function mapGetUserMediaError(error: unknown): MicrophoneErrorKind {
  const name = (error as { name?: string } | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'permission-denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'no-microphone';
    case 'NotReadableError':
    case 'AbortError':
      return 'busy';
    default:
      return 'unknown';
  }
}

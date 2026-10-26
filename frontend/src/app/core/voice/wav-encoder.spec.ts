import { WAV_SAMPLE_RATE, encodeWav, toWav } from './wav-encoder';

async function bytesOf(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

function ascii(view: DataView, offset: number, length: number): string {
  return String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));
}

describe('encodeWav', () => {
  it('writes a valid 16-bit mono PCM WAV header', async () => {
    const view = await bytesOf(encodeWav(new Float32Array(16_000), WAV_SAMPLE_RATE));

    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(ascii(view, 8, 4)).toBe('WAVE');
    expect(ascii(view, 12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16); // bits
    expect(ascii(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(32_000); // 1 s × 16 000 × 2 bytes
    expect(view.byteLength).toBe(44 + 32_000);
  });

  it('converts samples to 16-bit integers and clips out-of-range values', async () => {
    const view = await bytesOf(encodeWav(new Float32Array([0, 1, -1, 2, -2, 0.5]), WAV_SAMPLE_RATE));
    const sample = (i: number) => view.getInt16(44 + i * 2, true);

    expect([sample(0), sample(1), sample(2), sample(3), sample(4)]).toEqual([0, 32767, -32768, 32767, -32768]);
    expect(sample(5)).toBe(Math.trunc(0.5 * 0x7fff));
  });

  it('a 60 s question stays well below the 5 MB backend limit', () => {
    expect(encodeWav(new Float32Array(60 * WAV_SAMPLE_RATE), WAV_SAMPLE_RATE).size).toBeLessThan(2 * 1024 * 1024);
  });
});

describe('toWav', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns WAV input untouched', async () => {
    const wav = new Blob(['x'], { type: 'audio/wav' });

    expect(await toWav(wav)).toBe(wav);
  });

  it('decodes at 16 kHz, mixes to mono and encodes as WAV', async () => {
    const decodeAudioData = vi.fn().mockResolvedValue({
      numberOfChannels: 2,
      length: 2,
      sampleRate: 16_000,
      getChannelData: (channel: number) => (channel === 0 ? new Float32Array([1, 0]) : new Float32Array([0, 0])),
    });
    const contexts: unknown[][] = [];
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        constructor(...args: unknown[]) {
          contexts.push(args);
        }
        decodeAudioData = decodeAudioData;
      },
    );

    const wav = await toWav(new Blob(['webm'], { type: 'audio/webm;codecs=opus' }));
    const view = await bytesOf(wav);

    expect(contexts[0]).toEqual([1, 1, 16_000]);
    expect(wav.type).toBe('audio/wav');
    expect(view.getInt16(44, true)).toBe(Math.trunc(0.5 * 0x7fff)); // (1 + 0) / 2
  });

  it('falls back to the original recording if the browser cannot decode it', async () => {
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        decodeAudioData = () => Promise.reject(new DOMException('no', 'EncodingError'));
      },
    );
    const original = new Blob(['?'], { type: 'audio/webm' });

    expect(await toWav(original)).toBe(original);
  });
});

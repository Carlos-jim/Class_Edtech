/** 16 kHz mono es lo que usan internamente los modelos de voz: menos bytes sin perder precisión. */
export const WAV_SAMPLE_RATE = 16_000;

/**
 * Convierte la grabación del navegador (webm/opus, mp4/aac, ogg...) a WAV PCM 16 bits mono a 16 kHz.
 *
 * WAV lo aceptan todos los proveedores de transcripción (Gemini, por ejemplo, rechaza webm y ogg). Un minuto ocupa
 * ~1,9 MB, por debajo del límite de 5 MB del backend. Si el navegador no puede decodificar el audio, se devuelve el
 * original sin convertir.
 */
export async function toWav(audio: Blob, sampleRate = WAV_SAMPLE_RATE): Promise<Blob> {
  if (audio.type.startsWith('audio/wav') || typeof OfflineAudioContext === 'undefined') {
    return audio;
  }
  try {
    // decodeAudioData remuestrea a la frecuencia del contexto: 16 kHz directamente.
    const decoder = new OfflineAudioContext(1, 1, sampleRate);
    const decoded = await decoder.decodeAudioData(await audio.arrayBuffer());
    return encodeWav(downmix(decoded), decoded.sampleRate);
  } catch {
    return audio;
  }
}

/** Mezcla todos los canales en uno (media). */
function downmix(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      mono[i]! += data[i]! / buffer.numberOfChannels;
    }
  }
  return mono;
}

/** WAV PCM 16 bits little-endian, un canal. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // tamaño del bloque fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // bytes por segundo
  view.setUint16(32, bytesPerSample, true); // alineación de bloque
  view.setUint16(34, 16, true); // bits por muestra
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * bytesPerSample, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

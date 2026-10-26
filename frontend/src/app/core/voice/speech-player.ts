import { Injectable, signal } from '@angular/core';

/** Lectura que no llegó a sonar: el navegador no tiene voces o el motor de síntesis falló. */
export interface SpeechFailure {
  readonly id: string;
  readonly text: string;
}

/** Si en este tiempo no empieza a sonar, el motor de síntesis no está disponible (p. ej. Linux sin voces). */
export const SPEECH_START_TIMEOUT_MS = 3000;

/**
 * Texto a voz con la Web Speech API del navegador (gratuita, sin enviar datos a terceros desde nuestro backend).
 * Adaptador: elige una voz en español, trocea el texto por frases (Chrome corta los textos largos al ~15 s),
 * expone qué mensaje se está reproduciendo y detecta cuándo no se oye nada: la API no lanza errores si el sistema
 * no tiene voces (Linux sin speech-dispatcher, navegadores Flatpak), simplemente se queda en silencio.
 */
@Injectable({ providedIn: 'root' })
export class SpeechPlayer {
  readonly speakingId = signal<string | null>(null);
  readonly failure = signal<SpeechFailure | null>(null);

  private startWatchdog?: ReturnType<typeof setTimeout>;

  constructor() {
    // Chrome carga las voces de forma asíncrona: pedirlas pronto hace que estén listas al pulsar «Escuchar».
    if (this.isSupported) {
      window.speechSynthesis.getVoices();
    }
  }

  get isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /** El navegador tiene una voz en español. Si no (Linux sin voces, Opera...), se usa el audio del servidor. */
  canSpeakSpanish(): boolean {
    return this.isSupported && pickSpanishVoice(window.speechSynthesis.getVoices()) !== undefined;
  }

  speak(id: string, text: string): boolean {
    if (!this.isSupported || !text.trim()) {
      return false;
    }
    const synth = window.speechSynthesis;
    this.clearWatchdog();
    synth.cancel();
    const voice = pickSpanishVoice(synth.getVoices());
    const parts = splitIntoSentences(text);

    this.failure.set(null);
    this.speakingId.set(id);
    parts.forEach((part, index) => {
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.lang = voice?.lang ?? 'es-ES';
      if (voice) {
        utterance.voice = voice;
      }
      utterance.rate = 1;
      if (index === 0) {
        utterance.onstart = () => this.clearWatchdog();
      }
      if (index === parts.length - 1) {
        utterance.onend = () => this.finished(id);
      }
      utterance.onerror = (event) => {
        // 'interrupted' / 'canceled' son nuestros propios cancel() (Detener, otra respuesta): no son fallos.
        if (event?.error === 'interrupted' || event?.error === 'canceled') {
          this.finished(id);
        } else {
          this.fail(id, text);
        }
      };
      synth.speak(utterance);
    });
    // Chrome puede dejar la cola en pausa tras un cancel(): sin esto, a veces no suena nada.
    synth.resume();
    this.startWatchdog = setTimeout(() => this.fail(id, text), SPEECH_START_TIMEOUT_MS);
    return true;
  }

  toggle(id: string, text: string): void {
    if (this.speakingId() === id) {
      this.stop();
    } else {
      this.speak(id, text);
    }
  }

  stop(): void {
    this.clearWatchdog();
    if (this.isSupported) {
      window.speechSynthesis.cancel();
    }
    this.speakingId.set(null);
  }

  private finished(id: string): void {
    if (this.speakingId() === id) {
      this.clearWatchdog();
      this.speakingId.set(null);
    }
  }

  private fail(id: string, text: string): void {
    if (this.speakingId() !== id) {
      return;
    }
    this.stop();
    this.failure.set({ id, text });
  }

  private clearWatchdog(): void {
    clearTimeout(this.startWatchdog);
    this.startWatchdog = undefined;
  }
}

function pickSpanishVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang === 'es-ES') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('es'))
  );
}

/** Frases de hasta ~220 caracteres. Los "•" de las listas se leen como pausas, no como símbolos. */
export function splitIntoSentences(text: string, maxLength = 220): string[] {
  const sentences = text
    .replace(/•/g, '')
    .split(/(?<=[.!?…:])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const parts: string[] = [];
  for (const sentence of sentences) {
    const last = parts.at(-1);
    if (last && last.length + sentence.length + 1 <= maxLength) {
      parts[parts.length - 1] = `${last} ${sentence}`;
    } else {
      parts.push(sentence);
    }
  }
  return parts;
}

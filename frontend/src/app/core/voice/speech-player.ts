import { Injectable, signal } from '@angular/core';

/**
 * Texto a voz con la Web Speech API del navegador (gratuita, sin enviar datos a terceros desde nuestro backend).
 * Adaptador: elige una voz en español, trocea el texto por frases (Chrome corta los textos largos al ~15 s) y
 * expone qué mensaje se está reproduciendo.
 */
@Injectable({ providedIn: 'root' })
export class SpeechPlayer {
  readonly speakingId = signal<string | null>(null);

  get isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  speak(id: string, text: string): boolean {
    if (!this.isSupported || !text.trim()) {
      return false;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const voice = pickSpanishVoice(synth.getVoices());
    const parts = splitIntoSentences(text);

    this.speakingId.set(id);
    parts.forEach((part, index) => {
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.lang = voice?.lang ?? 'es-ES';
      if (voice) {
        utterance.voice = voice;
      }
      utterance.rate = 1;
      if (index === parts.length - 1) {
        utterance.onend = () => this.finished(id);
      }
      utterance.onerror = () => this.finished(id);
      synth.speak(utterance);
    });
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
    if (this.isSupported) {
      window.speechSynthesis.cancel();
    }
    this.speakingId.set(null);
  }

  private finished(id: string): void {
    if (this.speakingId() === id) {
      this.speakingId.set(null);
    }
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

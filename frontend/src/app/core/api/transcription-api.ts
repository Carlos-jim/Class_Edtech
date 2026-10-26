import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface TranscriptionResult {
  readonly text: string;
}

const EXTENSIONS: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
};

/** Voz a texto en el backend (la clave del proveedor nunca llega al navegador). */
@Injectable({ providedIn: 'root' })
export class TranscriptionApi {
  private readonly http = inject(HttpClient);

  /**
   * @param lessonId lección en curso: el backend usa su vocabulario como contexto para transcribir mejor
   *                 (p. ej. «códigos de estado», «PATCH») y comprueba que el alumno tiene acceso a ella.
   */
  transcribe(audio: Blob, lessonId?: string | null): Observable<TranscriptionResult> {
    const extension = EXTENSIONS[audio.type.split(';')[0]!.trim()] ?? 'webm';
    const form = new FormData();
    form.append('audio', audio, `pregunta.${extension}`);
    if (lessonId) {
      form.append('lessonId', lessonId);
    }
    return this.http.post<TranscriptionResult>('/api/transcriptions', form);
  }
}

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

  transcribe(audio: Blob): Observable<TranscriptionResult> {
    const extension = EXTENSIONS[audio.type.split(';')[0]!.trim()] ?? 'webm';
    const form = new FormData();
    form.append('audio', audio, `pregunta.${extension}`);
    return this.http.post<TranscriptionResult>('/api/transcriptions', form);
  }
}

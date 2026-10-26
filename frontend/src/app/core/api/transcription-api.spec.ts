import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranscriptionApi } from './transcription-api';

describe('TranscriptionApi', () => {
  let api: TranscriptionApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(TranscriptionApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uploads the recording as multipart with the lesson as context', () => {
    api.transcribe(new Blob(['RIFF'], { type: 'audio/wav' }), 'l2').subscribe();

    const request = http.expectOne('/api/transcriptions');
    const form = request.request.body as FormData;
    expect((form.get('audio') as File).name).toBe('pregunta.wav');
    expect(form.get('lessonId')).toBe('l2');
    request.flush({ text: 'hola' });
  });

  it('omits the lesson when there is none', () => {
    api.transcribe(new Blob(['x'], { type: 'audio/webm;codecs=opus' })).subscribe();

    const form = http.expectOne('/api/transcriptions').request.body as FormData;
    expect((form.get('audio') as File).name).toBe('pregunta.webm');
    expect(form.has('lessonId')).toBe(false);
  });
});

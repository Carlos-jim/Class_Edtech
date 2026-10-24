import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface CourseSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly lessonCount: number;
  readonly totalMinutes: number;
  readonly firstLessonId: string | null;
}

export interface LessonSummary {
  readonly id: string;
  readonly position: number;
  readonly title: string;
  readonly summary: string;
  readonly estimatedMinutes: number;
}

export interface CourseDetail {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly lessons: readonly LessonSummary[];
}

export interface LessonDetail {
  readonly id: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly position: number;
  readonly title: string;
  readonly summary: string;
  readonly estimatedMinutes: number;
  /** Markdown: renderizar SIEMPRE sanitizado. */
  readonly content: string;
  readonly previousLessonId: string | null;
  readonly nextLessonId: string | null;
}

/** Catálogo del alumno autenticado. El backend filtra por matrícula: el cliente nunca envía su id. */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);

  myCourses(): Observable<CourseSummary[]> {
    return this.http.get<CourseSummary[]>('/api/courses');
  }

  course(courseId: string): Observable<CourseDetail> {
    return this.http.get<CourseDetail>(`/api/courses/${encodeURIComponent(courseId)}`);
  }

  lesson(lessonId: string): Observable<LessonDetail> {
    return this.http.get<LessonDetail>(`/api/lessons/${encodeURIComponent(lessonId)}`);
  }
}

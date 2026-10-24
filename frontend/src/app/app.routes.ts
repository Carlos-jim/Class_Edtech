import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión · EdTech Tutor',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'courses' },
      {
        path: 'courses',
        title: 'Mis cursos · EdTech Tutor',
        loadComponent: () => import('./features/courses/courses-page').then((m) => m.CoursesPage),
      },
      {
        path: 'lessons/:lessonId',
        title: 'Lección · EdTech Tutor',
        loadComponent: () => import('./features/lesson/lesson-page').then((m) => m.LessonPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

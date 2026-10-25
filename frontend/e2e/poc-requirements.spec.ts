/**
 * E2E alineados al enunciado de la evaluación técnica (requisitos 01–06).
 *
 * Pensados para el stack Docker con IA real (Groq). Las aserciones del tutor son
 * semánticas (insignia grounded / contenido relacionado), no frases fijas del mock.
 *
 *   docker compose up -d --build
 *   cd frontend && E2E_BASE_URL=http://localhost:8080 npm run e2e:poc
 *
 * La voz usa el micrófono simulado de Chromium; Whisper real no entiende ese tono,
 * así que el test de voz fija la transcripción vía API (el resto del flujo —revisar,
 * enviar como VOICE, escuchar— es real, igual que el LLM).
 */
import { LESSON_1, LESSON_2, expect, resetConversations, stubSpeechSynthesis, test } from './fixtures';

test.describe.configure({ timeout: 90_000 });

test.describe('POC · requisitos del enunciado (01–06)', () => {
  test.beforeEach(async ({ signInAs }) => {
    resetConversations();
    await signInAs('ana');
  });

  test('01 Contenido: un curso con dos lecciones de ejemplo', async ({ page, lessonPage }) => {
    await page.goto('/courses');

    await expect(page.getByRole('heading', { name: /Fundamentos de APIs REST/ })).toBeVisible();
    await page.getByRole('link', { name: /Empezar curso: Fundamentos de APIs REST/ }).click();

    await expect(lessonPage.title).toContainText('Introducción a las APIs REST');
    const syllabus = page.getByRole('navigation', { name: 'Temario del curso' });
    // Temario = enlace «Mis cursos» + 2 lecciones
    await expect(syllabus.getByRole('link', { name: /Introducción a las APIs REST/ })).toBeVisible();
    await expect(syllabus.getByRole('link', { name: /Métodos HTTP/ })).toBeVisible();

    await syllabus.getByRole('link', { name: /Métodos HTTP/ }).click();
    await expect(lessonPage.title).toContainText('Métodos HTTP');
    await expect(lessonPage.body).toContainText('POST');
  });

  test('02 Alumnos y acceso: Bruno no ve el curso ni la lección', async ({ page, signInAs, lessonPage }) => {
    await signInAs('bruno');
    await page.goto('/courses');

    await expect(page.getByRole('heading', { name: 'Hola, Bruno' })).toBeVisible();
    await expect(page.getByTestId('courses-empty')).toBeVisible();

    await lessonPage.goto(LESSON_2);
    await expect(lessonPage.denied).toContainText('No tienes acceso a esta lección');
    await expect(lessonPage.body).toHaveCount(0);
    await expect(lessonPage.composer).toHaveCount(0);
  });

  test('03 Tutor contextual: responde con la lección e indica cuando no basta', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);

    await lessonPage.askAndAwait('¿Para qué sirve POST?', 1);
    await expect(lessonPage.studentMessages.last()).toHaveText('¿Para qué sirve POST?');
    await expect(lessonPage.badgeOf(0)).toContainText('Basado en la lección');
    await expect(lessonPage.answer(0)).toContainText(/POST/i);
    await expect(lessonPage.answer(0)).toContainText(/recurso|crear|colección|201/i);
    const citation = page.getByTestId('tutor-citation').first();
    await expect(citation).toBeVisible();
    await expect(citation).toContainText(/POST|recurso|crear|colección/i);

    await lessonPage.askAndAwait('¿Cuál es la capital de Francia?', 2);
    await expect(lessonPage.badgeOf(1)).toContainText('Sin información suficiente en la lección');
    await expect(page.getByTestId('tutor-citation')).toHaveCount(1); // solo la grounded anterior
  });

  test('04 Voz y texto: preguntar, revisar transcripción, escuchar la respuesta', async ({ page, lessonPage }) => {
    await stubSpeechSynthesis(page);

    // Transcripción fija: el fake-device de Chromium no produce habla útil para Whisper.
    await page.route('**/api/transcriptions', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: '¿Para qué sirve POST?' }),
      });
    });

    await lessonPage.goto(LESSON_2);

    await lessonPage.micButton.click();
    await expect(lessonPage.recordingBar).toBeVisible();
    await expect(lessonPage.status).toContainText('Escuchando');
    await page.waitForTimeout(1200);
    await lessonPage.stopRecordingButton.click();

    await expect(lessonPage.voiceReview).toBeVisible();
    await expect(lessonPage.composer).toHaveValue('¿Para qué sirve POST?');
    await lessonPage.composer.fill('¿Para qué sirve POST en una API REST?');
    await lessonPage.composer.press('Enter');

    await expect(lessonPage.studentMessages.last()).toHaveText('¿Para qué sirve POST en una API REST?');
    await expect(page.locator('app-chat-message').filter({ has: lessonPage.studentMessages }).last()).toContainText(
      'Por voz',
    );
    await expect(lessonPage.tutorMessages).toHaveCount(1, { timeout: 45_000 });
    await expect(lessonPage.badgeOf(0)).toContainText('Basado en la lección');

    await expect(page.getByRole('button', { name: 'Detener lectura de la respuesta' })).toBeVisible();
    const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.join(' '));
    expect(spoken.length).toBeGreaterThan(20);
    expect(spoken.toLowerCase()).toMatch(/post|recurso|crear/);

    // También se puede escuchar una respuesta pedida por texto
    await lessonPage.ask('¿Qué hace GET?');
    await expect(lessonPage.tutorMessages).toHaveCount(2, { timeout: 45_000 });
    await page.getByRole('button', { name: 'Escuchar respuesta' }).last().click();
    await expect(page.getByRole('button', { name: 'Detener lectura de la respuesta' })).toBeVisible();
  });

  test('05 Continuidad: el historial se recupera en una visita posterior', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);
    await lessonPage.askAndAwait('¿Qué diferencia hay entre PUT y PATCH?', 1);
    const firstAnswer = (await lessonPage.answer(0).innerText()).trim();
    expect(firstAnswer.length).toBeGreaterThan(20);

    await page.goto('/courses');
    await lessonPage.goto(LESSON_2);

    await expect(lessonPage.studentMessages).toHaveText(['¿Qué diferencia hay entre PUT y PATCH?']);
    await expect(lessonPage.tutorMessages).toHaveCount(1);
    await expect(lessonPage.answer(0)).toHaveText(firstAnswer);

    // Historial aislado por lección
    await lessonPage.goto(LESSON_1);
    await expect(lessonPage.studentMessages).toHaveCount(0);
  });

  test('06 Experiencia: estados visibles y recuperación ante fallos', async ({ page, lessonPage }) => {
    await lessonPage.goto(LESSON_2);

    // Fallo del servicio de IA → reintento con éxito (stub): valida la UX sin depender de la cuota de Groq.
    let postCalls = 0;
    await page.route('**/api/lessons/*/messages', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.continue();
      }
      postCalls++;
      if (postCalls === 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            status: 503,
            code: 'AI_UNAVAILABLE',
            detail: 'El tutor no está disponible en este momento.',
          }),
        });
      }
      const now = new Date().toISOString();
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          question: {
            id: 'q-retry',
            role: 'STUDENT',
            content: '¿Qué es DELETE?',
            inputMode: 'TEXT',
            grounded: null,
            citation: null,
            createdAt: now,
          },
          answer: {
            id: 'a-retry',
            role: 'TUTOR',
            content: 'DELETE sirve para borrar un recurso.',
            inputMode: null,
            grounded: true,
            citation: 'Sirve para borrar un recurso.',
            createdAt: now,
          },
        }),
      });
    });

    await lessonPage.ask('¿Qué es DELETE?');
    await expect(lessonPage.error).toContainText('El tutor no está disponible');
    await expect(lessonPage.composer).toHaveValue('¿Qué es DELETE?');
    await expect(lessonPage.tutorMessages).toHaveCount(0);

    await lessonPage.error.getByRole('button', { name: 'Reintentar' }).click();
    await expect(lessonPage.tutorMessages).toHaveCount(1, { timeout: 15_000 });
    await expect(lessonPage.answer(0)).toContainText('DELETE');
    await expect(lessonPage.error).toHaveCount(0);

    // Micrófono denegado → alternativa por texto
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('denegado', 'NotAllowedError'));
    });
    await lessonPage.goto(LESSON_2);
    await lessonPage.micButton.click();
    await expect(lessonPage.error).toContainText('No tenemos permiso para usar el micrófono');
    await lessonPage.error.getByRole('button', { name: 'Escribir en su lugar' }).click();
    await expect(lessonPage.composer).toBeFocused();

    // Sin conexión
    await page.route('**/api/lessons/*/messages', (route) =>
      route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.fallback(),
    );
    await lessonPage.ask('¿Qué es un recurso?');
    await expect(lessonPage.error).toContainText('No hay conexión con el servidor');
    await expect(lessonPage.composer).toHaveValue('¿Qué es un recurso?');
  });
});

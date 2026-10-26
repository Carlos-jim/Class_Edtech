# Guion de la demostración (≈ 10 minutos)

## Preparación (antes de empezar)

```bash
docker compose up -d --build                     # stack completo en http://localhost:8080
docker compose exec -T postgres psql -U tutor -d tutor -c "DELETE FROM conversation"   # conversaciones limpias
```

- Navegador con permiso de micrófono y altavoz (Chrome o Edge recomendados).
- Pestañas listas: la app, el repositorio en GitHub (pestaña *Actions* con el último CI en verde) y `docs/DECISIONS.md`.
- `GEMINI_API_KEY` en `.env` (el tutor y la voz usan Gemini por defecto; Groq y Mistral son seleccionables con
  `LLM_PROVIDER`). Comprobar antes que hay red hacia el proveedor elegido (`docker compose logs backend`).

## 1. Contexto (1 min)

"POC de un LMS con tutor de IA. Lo importante: el tutor responde **solo con la lección**, por texto o voz, la
conversación se conserva, y el acceso está protegido de verdad en el backend."

Arquitectura en una frase: Angular + Spring Boot, monolito modular, puertos y adaptadores para la IA y la voz (Gemini por
defecto, Groq o Mistral por configuración; un adaptador simulado para los tests), PostgreSQL, todo en Docker.

## 2. Acceso y contenido — requisitos 01 y 02 (1,5 min)

1. Login: enseñar validación, error genérico con contraseña incorrecta ("no revela si el correo existe").
2. Entrar como **Ana** → *Mis cursos* → *Empezar curso*. Temario (Coursera), lección en Markdown.
3. Cerrar sesión → entrar como **Bruno**: sin cursos. Pegar la URL de la lección de Ana → *No tienes acceso*.
   - Explicar: identidad desde el JWT, matrícula comprobada en la consulta, 404 idéntico a "no existe" (IDOR).

## 3. Tutor contextual — requisito 03 (2 min)

Como Ana, en *Métodos HTTP*:

1. Sugerencia *Explícame: POST* o escribir «¿Para qué sirve POST?» → insignia verde **Basado en la lección** y
   bloque *De la lección:* con la cita verificada.
2. «¿Cuál es la capital de Francia?» → insignia ámbar **Sin información suficiente en la lección** (sin cita).
3. Explicar: lección delimitada en el prompt, JSON `{answer, grounded, citation}`, el backend **verifica** que la
   cita existe en el texto (si no, degrada a no grounded); defensas frente a inyección; respuestas como texto (XSS).

## 4. Voz — requisito 04 (2 min)

1. Pulsar el micrófono → barra *Escuchando…* con temporizador y nivel.
2. Preguntar en voz alta «¿Qué diferencia hay entre PUT y PATCH?» → *Detener*.
3. *Transcribiendo…* → el texto aparece **editable**: corregir algo y pulsar Intro.
4. La respuesta se lee en voz alta; enseñar *Escuchar/Detener* en otra respuesta.

## 5. Continuidad — requisito 05 (0,5 min)

Recargar la página (o salir y volver a entrar): la conversación sigue. Cambiar a la lección 1: conversación distinta.

## 6. Estados y recuperación de errores — requisito 06 (1,5 min)

1. DevTools → *Network → Offline* → enviar → mensaje de conexión, la pregunta **sigue en el cuadro** → volver
   *Online* → *Reintentar*.
2. Bloquear el micrófono en el candado del navegador → pulsar micrófono → mensaje claro y *Escribir en su lugar*.
3. Mencionar: retry + circuit breaker con el proveedor real, rate limiting (429).

## 7. Calidad y cierre (1,5 min)

- GitHub *Actions*: CI con backend, frontend y E2E sobre Docker.
- Tests: 194 (backend 104, frontend 67, Playwright 23 con micrófono simulado y auditoría de accesibilidad).
- `docs/DECISIONS.md`: decisiones (sin RAG por tamaño, proveedor intercambiable: Gemini tras el bloqueo de red de Groq y el fin de las claves gratuitas de Mistral, revisión de la transcripción…) y
  límites honestos (grounding decidido por el modelo, JWT en `sessionStorage`, rate limit en memoria).

## Preguntas probables

| Pregunta | Respuesta corta |
|---|---|
| ¿Por qué no RAG? | Dos lecciones caben enteras en el contexto; RAG añadiría complejidad sin mejora. Está aislado en `PromptBuilder` para añadirlo. |
| ¿Cómo evitas que el tutor invente? | Prompt restrictivo + JSON con `grounded` + temperatura baja; es mitigación. Mejora: citar y verificar el fragmento. |
| ¿Qué pasa si el proveedor de IA cae? | Timeout, un reintento, circuit breaker; el alumno ve un error con *Reintentar* y no pierde la pregunta. |
| ¿Por qué el audio va al backend? | La clave no puede estar en el navegador; Whisper funciona en todos los navegadores (Web Speech API no). |
| ¿Cómo se prueba la voz automáticamente? | Chromium con micrófono simulado en Playwright y transcripción mock en el backend. |
| ¿Y si alguien cambia el id en la URL? | 404: la consulta filtra por el alumno del token; tests de IDOR con dos alumnas matriculadas. |

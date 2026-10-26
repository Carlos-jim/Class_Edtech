# POC LMS — Tutor virtual con IA y voz

[![CI](https://github.com/Carlos-jim/Class_Edtech/actions/workflows/ci.yml/badge.svg)](https://github.com/Carlos-jim/Class_Edtech/actions/workflows/ci.yml)

Un alumno autorizado abre una lección y pregunta a un tutor de IA **por texto o por voz**. El tutor responde con el
contenido de la lección (o avisa de que no tiene información suficiente), la respuesta **se puede escuchar** y la
conversación **se recupera** al volver. Una cuenta sin acceso no puede ver la lección ni los mensajes de nadie.

**Stack:** Angular 22 · Tailwind 4 · Spring Boot 4 (Java 25) · PostgreSQL 17 · Groq (gpt-oss-120b + Whisper) · Docker

| Documento | Contenido |
|---|---|
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decisiones de arquitectura, seguridad e IA; límites y aspectos no desarrollados |
| [`docs/DEMO.md`](docs/DEMO.md) | Guion de la demostración (≈ 10 min) |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Guía de diseño y plataformas de referencia (Coursera, Khanmigo, Udemy, Linear) |

---

## 1. Puesta en marcha rápida (Docker, sin claves)

Requisitos: Docker con Docker Compose.

```bash
cp .env.example .env
sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48)|" .env   # o edítalo a mano (≥ 32 caracteres)
docker compose up --build
```

En **Windows** (Docker Desktop, PowerShell; desde la raíz del repo):

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
$envText = [IO.File]::ReadAllText("$PWD\.env.example") -replace '(?m)^JWT_SECRET=[^\r\n]*', ("JWT_SECRET=" + [Convert]::ToBase64String($b))
[IO.File]::WriteAllText("$PWD\.env", $envText)
docker compose up --build
```

Abre **http://localhost:8080**. En la pantalla de login hay accesos directos a las dos cuentas de prueba:

> Funciona igual en Linux, macOS y Windows (red bridge de Docker). Si con Groq ves **403**
> (*Access denied. Please check your network settings*): en algunas redes Groq rechaza la salida desde el bridge de
> Docker y solo acepta la del propio host. En Linux, añade `COMPOSE_FILE=docker-compose.yml:docker-compose.host.yml`
> a `.env` (el backend pasa a la red del host, puerto `BACKEND_PORT`, por defecto 8081). La JVM ya prefiere IPv6
> (`-Djava.net.preferIPv6Addresses=true`).

| Usuario | Contraseña | Acceso |
|---|---|---|
| `ana.garcia@demo.edtech` | `Demo1234!` | Matriculada en *Fundamentos de APIs REST* (2 lecciones) |
| `bruno.lopez@demo.edtech` | `Demo1234!` | Sin acceso al curso |

Por defecto la IA y la transcripción funcionan en **modo simulado** (`LLM_PROVIDER=mock`): no hace falta ninguna clave
y el recorrido completo es demostrable. Para usar el modelo real, ver la [sección 3](#3-ia-real-con-groq-gratuito).

> El puerto se cambia con `APP_PORT` en `.env`. La base de datos se publica solo en `127.0.0.1:${DB_PORT}`.
> Si `docker compose up` falla con *port is already allocated* (otro contenedor o servicio usa el 8080 o el 5433),
> cambia `APP_PORT` o `DB_PORT` en `.env` por uno libre y ejecuta `docker compose down && docker compose up --build`.

## 2. Cómo comprobar cada requisito

| # | Requisito | Cómo comprobarlo |
|---|---|---|
| 01 | **Contenido**: 1 curso y 2 lecciones | Entra como Ana → *Mis cursos* → *Empezar curso*. Temario a la izquierda, lección en el centro. |
| 02 | **Alumnos y acceso** | Entra como Bruno: no tiene cursos. Pega la URL de una lección de Ana (`/lessons/e0000000-0000-4000-8000-000000000002`): *No tienes acceso a esta lección*. |
| 03 | **Tutor contextual** | En *Métodos HTTP* pregunta «¿Para qué sirve POST?» → respuesta con la insignia verde *Basado en la lección*. Pregunta «¿Cuál es la capital de Francia?» → insignia ámbar *Sin información suficiente en la lección*. |
| 04 | **Voz y texto** | Pulsa el micrófono, habla y detén: el texto transcrito aparece para **revisarlo y editarlo** antes de enviar. La respuesta a una pregunta por voz se lee en voz alta; cualquier respuesta tiene el botón **Escuchar**. |
| 05 | **Continuidad** | Recarga la página, o cierra sesión y vuelve a entrar: la conversación de cada lección sigue ahí (es por alumno y por lección). |
| 06 | **Estados y errores** | El panel muestra *Escuchando…*, *Transcribiendo…*, *El tutor está pensando…*, *Reproduciendo respuesta…*. Para ver la recuperación: escribe una pregunta que contenga `#simular-fallo` (caída simulada de la IA: la pregunta se conserva y aparece *Reintentar*); deniega el permiso del micrófono (*Escribir en su lugar*); o desconecta la red (DevTools → *Offline*). |

La lectura en voz alta usa las voces del navegador (`speechSynthesis`). Si el navegador no tiene ninguna —en Linux
hace falta `speech-dispatcher`, y los navegadores Flatpak (p. ej. Opera) no lo ven— el panel lo avisa con *Reintentar*
en lugar de quedarse en silencio. Chrome, Edge o Firefox nativos funcionan.

En el modo simulado la transcripción siempre devuelve «¿Para qué sirve POST?» (se puede editar antes de enviar); con
Groq se transcribe la voz real.

## 3. IA real con Groq (gratuito)

1. Crea una clave en https://console.groq.com/keys (plan gratuito).
2. En `.env`: `LLM_PROVIDER=groq` y `GROQ_API_KEY=gsk_...` (la transcripción usa el mismo proveedor salvo que se
   indique `STT_PROVIDER`).
3. `docker compose up --build` de nuevo.

Modelos: `openai/gpt-oss-120b` para el tutor (`GROQ_MODEL`; reemplazo actual del Llama 3.3 retirado en el plan
gratuito de Groq) y `whisper-large-v3-turbo` para la voz. La clave solo vive en el backend; si falta con
`LLM_PROVIDER=groq`, la aplicación no arranca y explica cómo resolverlo.

## 4. Desarrollo local (sin Docker para la app)

Requisitos: JDK 25, Node 24 LTS (`frontend/.nvmrc`; Angular 22 no admite Node 25) y Docker para PostgreSQL.

```bash
cp .env.example .env               # define DB_PASSWORD y JWT_SECRET
docker compose up -d postgres

cd backend && ./mvnw spring-boot:run          # http://localhost:8080 (lee ../.env)
cd frontend && nvm use && npm ci && npm start # http://localhost:4200 (proxy de /api al backend)
```

Flyway crea el esquema y carga los datos de demostración al arrancar.

## 5. Tests y CI

```bash
cd backend  && ./mvnw verify       # 110 tests: unitarios, integración (Testcontainers) y E2E de API
cd frontend && npm run test:ci     # 71 tests unitarios (Vitest)

# E2E de interfaz (Playwright, Chromium con micrófono simulado) contra el stack de Docker:
docker compose up -d --build
cd frontend && npx playwright install chromium && E2E_BASE_URL=http://localhost:8080 npm run e2e   # suite completa

# Solo el recorrido del enunciado (01–06), pensado también para LLM_PROVIDER=groq:
E2E_BASE_URL=http://localhost:8080 npm run e2e:poc
```

> Los E2E hacen muchas peticiones seguidas: en `.env` sube los límites (`RATE_LIMIT_*_PER_MINUTE=1000`), como hace
> la CI. Necesitan Docker en la máquina (reinician las conversaciones entre tests). Con Groq, `e2e:poc` usa
> aserciones semánticas (insignias grounded) en lugar de las frases fijas del mock.

| Nivel | Qué cubre |
|---|---|
| Backend · unitarios | Prompt (grounding, inyección), proveedores IA/voz (contrato HTTP, clasificación de errores, timeouts), retry y circuit breaker, validación de audio, rate limiter |
| Backend · integración | JWT (token manipulado, caducado, otro secreto/emisor), CORS, cabeceras, **IDOR** entre alumnos, validación, fallos de IA y voz, límites de uso |
| Backend · E2E de API | Servidor real: login → curso → lección → voz → preguntas → nuevo login → historial; cuenta sin acceso |
| Frontend · unitarios | Sesión, interceptors, guards, saneado de Markdown (XSS), máquina de estados del tutor (texto y voz), grabación y lectura en voz alta, páginas |
| **E2E de interfaz** | Recorrido completo, control de acceso e IDOR, historial, fallo de IA y sin conexión, XSS, voz (grabar → revisar → enviar → escuchar), micrófono denegado, reintento de transcripción, móvil y **accesibilidad WCAG 2.1 AA (axe-core)** |

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): en cada push y PR se ejecutan los tests del backend
y del frontend y, si pasan, se levanta el stack Docker completo y se ejecutan los E2E de Playwright.

## 6. Arquitectura

```
 Navegador (Angular)                    nginx                      Spring Boot                      Externos
┌────────────────────────┐   /      ┌──────────┐   /api   ┌──────────────────────────────┐
│ Login · Mis cursos     │◀────────▶│ SPA + CSP│◀────────▶│ auth      JWT, rate limit    │
│ Lección + Tutor        │          └──────────┘          │ catalog   AccessPolicy       │
│  · TutorStore (estado) │                                │ tutor     LlmPort ───────────┼──▶ Groq LLM / mock
│  · MediaRecorder (voz) │                                │ speech    TranscriptionPort ─┼──▶ Groq Whisper / mock
│  · speechSynthesis TTS │                                │ Flyway + JPA ────────────────┼──▶ PostgreSQL
└────────────────────────┘                                └──────────────────────────────┘
```

Monolito modular organizado por funcionalidad, con **puertos y adaptadores** donde cambia el proveedor externo (IA y
voz). Detalle de decisiones y patrones en [`docs/DECISIONS.md`](docs/DECISIONS.md).

### API

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/login` | público | `{email, password}` → `{accessToken, expiresAt, student}` |
| `GET` | `/api/auth/me` | Bearer | Perfil del alumno del token |
| `GET` | `/api/courses` | Bearer | Cursos en los que está matriculado |
| `GET` | `/api/courses/{id}` | Bearer + matrícula | Curso con su temario |
| `GET` | `/api/lessons/{id}` | Bearer + matrícula | Lección (Markdown) con navegación |
| `GET` | `/api/lessons/{id}/messages` | Bearer + matrícula | Historial **del alumno** en esa lección |
| `POST` | `/api/lessons/{id}/messages` | Bearer + matrícula | `{content, inputMode: TEXT\|VOICE}` → `{question, answer}` con `answer.grounded` |
| `POST` | `/api/transcriptions` | Bearer | Multipart `audio` (webm/ogg/m4a/wav/mp3, ≤ 5 MB) → `{text}` |

Errores en formato RFC 9457 (`application/problem+json`) con un `code` estable (`INVALID_CREDENTIALS`,
`UNAUTHENTICATED`, `NOT_FOUND`, `AI_UNAVAILABLE`, `NO_SPEECH_DETECTED`, `RATE_LIMITED`…). Un recurso sin acceso
responde 404, igual que uno inexistente.

## 7. Seguridad (resumen)

- **Control de acceso / IDOR**: la identidad sale siempre del JWT; la matrícula se comprueba en la propia consulta;
  las conversaciones se buscan por (alumno, lección), nunca por un id del cliente.
- **XSS**: Markdown con `marked` + DOMPurify + saneado de Angular; mensajes siempre como texto; CSP estricta en nginx.
- **Inyección SQL**: JPA/consultas parametrizadas, sin SQL concatenado.
- **Credenciales**: BCrypt; secretos solo por variables de entorno; `.env` fuera de git; clave de Groq solo en el
  backend y enmascarada en logs.
- **Abuso**: límite de peticiones (login por IP; IA y voz por alumno), validación de tamaño y formato real del audio.

## Estructura

```
.
├── backend/              Spring Boot (auth, catalog, tutor, speech, shared) + Flyway (db/migration, db/seed)
├── frontend/             Angular (core, features, shared) + e2e/ (Playwright) + nginx/
├── docs/                 DECISIONS.md · DEMO.md · DESIGN.md
├── .github/workflows/    CI
├── docker-compose.yml    PostgreSQL + backend + frontend
└── .env.example          Variables de entorno (sin secretos)
```

Las credenciales de prueba son ficticias y exclusivas de la demo (`backend/src/main/resources/db/seed`).

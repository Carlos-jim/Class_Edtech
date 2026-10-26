# POC LMS — Tutor virtual con IA y voz

[![CI](https://github.com/Carlos-jim/Class_Edtech/actions/workflows/ci.yml/badge.svg)](https://github.com/Carlos-jim/Class_Edtech/actions/workflows/ci.yml)

Un alumno autorizado abre una lección y pregunta a un tutor de IA **por texto o por voz**. El tutor responde con el
contenido de la lección (o avisa de que no tiene información suficiente), la respuesta **se puede escuchar** y la
conversación **se recupera** al volver. Una cuenta sin acceso no puede ver la lección ni los mensajes de nadie.

**Stack:** Angular 22 · Tailwind 4 · Spring Boot 4 (Java 25) · PostgreSQL 17 · Google Gemini (chat + voz) · Groq / Mistral opcionales · Docker

| Documento | Contenido |
|---|---|
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decisiones de arquitectura, seguridad e IA; límites y aspectos no desarrollados |
| [`docs/DEMO.md`](docs/DEMO.md) | Guion de la demostración (≈ 10 min) |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Guía de diseño y plataformas de referencia (Coursera, Khanmigo, Udemy, Linear) |

---

## 0. Requisito: instalar Docker

La aplicación completa (base de datos, backend y frontend) se ejecuta con **Docker**; no hace falta instalar Java
ni Node. Comprueba si ya lo tienes:

```bash
docker compose version     # debe mostrar "Docker Compose version v2.x" o superior
```

Si no está instalado:

**Windows 10/11** — Docker Desktop con WSL 2 (PowerShell **como administrador**):

```powershell
wsl --install                                   # activa WSL 2 (reinicia si lo pide)
winget install -e --id Docker.DockerDesktop     # o descárgalo de https://www.docker.com/products/docker-desktop/
```

Abre **Docker Desktop** y espera a que indique *Engine running*. Docker Desktop debe estar abierto siempre que uses
la aplicación (si no, verás *failed to connect to the docker API … dockerDesktopLinuxEngine*).

**macOS** — Docker Desktop:

```bash
brew install --cask docker      # o descárgalo de https://www.docker.com/products/docker-desktop/
open -a Docker                  # espera a que el icono de la ballena indique que está en marcha
```

**Linux (Ubuntu, Debian, Fedora…)** — Docker Engine con el script oficial:

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # para usar docker sin sudo; cierra sesión y vuelve a entrar
```

Verifica la instalación con `docker run --rm hello-world`.

## 1. Puesta en marcha

Necesitas una **clave de Google Gemini** (gratuita, sin tarjeta): https://aistudio.google.com/apikey
(alternativas: ver la [sección 3](#3-proveedor-de-ia)).

### Primera vez (solo una vez)

**1. Crear la configuración (`.env`).** El script pide la clave de Gemini, genera el secreto JWT y crea `.env`.
Si `.env` ya existe **no lo toca**, así que ejecutarlo de nuevo es seguro.

```bash
./scripts/setup.sh                                          # Linux / macOS
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1  # Windows (PowerShell, en la raíz del repo)
```

<details>
<summary>Alternativa manual</summary>

Copia `.env.example` a `.env` **una sola vez** y edita en `.env`: `GEMINI_API_KEY` (tu clave) y `JWT_SECRET` (una
cadena aleatoria de al menos 32 caracteres, p. ej. la salida de `openssl rand -base64 48`).
</details>

**2. Construir y arrancar** (la primera vez tarda unos minutos: descarga imágenes y compila):

```bash
docker compose up -d --build
```

### Las siguientes veces

`.env` ya está creado y se reutiliza: **no hace falta volver a configurarlo** (no vuelvas a copiar `.env.example`,
sobrescribiría tu clave). Solo tienes que arrancar:

| Quiero… | Comando |
|---|---|
| Arrancar la aplicación | `docker compose up -d` |
| Pararla (los datos se conservan) | `docker compose stop` (o `docker compose down`) |
| Ver los logs del backend | `docker compose logs -f backend` |
| Aplicar cambios tras actualizar el código (`git pull`) | `docker compose up -d --build` |
| Cambiar la clave u otra opción | Edita `.env` y ejecuta `docker compose up -d` (recrea lo necesario) |
| Empezar de cero (**borra** conversaciones y BD) | `docker compose down -v` |

> En Windows y macOS, abre Docker Desktop antes de ejecutar estos comandos.

Abre **http://localhost:8080**. En la pantalla de login hay accesos directos a las dos cuentas de prueba:

> Funciona igual en Linux, macOS y Windows (red bridge de Docker).

| Usuario | Contraseña | Acceso |
|---|---|---|
| `ana.garcia@demo.edtech` | `Demo1234!` | Matriculada en *Fundamentos de APIs REST* (2 lecciones) |
| `bruno.lopez@demo.edtech` | `Demo1234!` | Sin acceso al curso |

El tutor y la transcripción de voz usan **Google Gemini** por defecto. Si falta la clave del proveedor elegido, el
backend no arranca y explica cuál falta y dónde conseguirla (`docker compose logs backend`). Más detalles en la
[sección 3](#3-proveedor-de-ia).

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
| 06 | **Estados y errores** | El panel muestra *Escuchando…*, *Transcribiendo…*, *El tutor está pensando…*, *Reproduciendo respuesta…*. Para ver la recuperación: desconecta la red (DevTools → *Network* → *Offline*) y envía una pregunta (se conserva y aparece *Reintentar*); o deniega el permiso del micrófono (*Escribir en su lugar*). |

La lectura en voz alta usa las voces del navegador (`speechSynthesis`). Si el navegador no tiene ninguna —en Linux
hace falta `speech-dispatcher`, y los navegadores Flatpak (p. ej. Opera) no lo ven— el panel lo avisa con *Reintentar*
en lugar de quedarse en silencio. Chrome, Edge o Firefox nativos funcionan.

## 3. Proveedor de IA

El tutor (chat) y la voz (transcripción) usan un proveedor con **API compatible con OpenAI**, detrás de los mismos
adaptadores: **cambiar de proveedor es solo editar `.env`**.

| `LLM_PROVIDER` | Clave en `.env` | Dónde conseguirla | Modelos (chat · voz) | Notas |
|---|---|---|---|---|
| `gemini` (por defecto) | `GEMINI_API_KEY` | https://aistudio.google.com/apikey | `gemini-3.5-flash-lite` · el mismo | Gratuito, sin tarjeta. La voz se transcribe enviando el audio (WAV) por el chat |
| `groq` | `GROQ_API_KEY` | https://console.groq.com/keys | `openai/gpt-oss-120b` · `whisper-large-v3-turbo` | Gratuito, pero **bloquea algunas redes/regiones** (403 *Access denied*) |
| `mistral` | `MISTRAL_API_KEY` | https://console.mistral.ai/api-keys | `mistral-small-latest` · `voxtral-mini-latest` | Desde oct-2026 su plan gratuito **no permite claves de API** |

1. Crea la clave y ponla en `.env` (el [script de configuración inicial](#primera-vez-solo-una-vez) lo hace para
   Gemini).
2. Elige proveedor con `LLM_PROVIDER`; la voz usa el mismo salvo que indiques `STT_PROVIDER` (se pueden mezclar).
3. `docker compose up -d` (recrea el backend con la nueva configuración).

Los modelos se cambian con `GEMINI_MODEL`, `GEMINI_TRANSCRIPTION_MODEL`, `GROQ_MODEL`, etc. Las claves solo viven en el
backend. El navegador convierte cada grabación a **WAV 16 kHz mono** antes de subirla (≈ 1,9 MB por minuto): es el
formato que aceptan todos los proveedores (Gemini rechaza webm/ogg).

> En el plan gratuito de Gemini, Google puede usar las peticiones para mejorar sus productos: no envíes datos
> personales. Si ves 503 *high demand*, es un pico temporal de Google: el backend reintenta y la UI ofrece *Reintentar*.

> Existe un proveedor simulado (`LLM_PROVIDER=mock`) **solo para los tests automáticos y la CI**: respuestas
> deterministas, sin red ni cuota. No está pensado para usar la aplicación.

## 4. Desarrollo local (sin Docker para la app)

Requisitos: JDK 25, Node 24 LTS (`frontend/.nvmrc`; Angular 22 no admite Node 25) y Docker para PostgreSQL.

```bash
./scripts/setup.sh                 # solo la primera vez (crea .env; si ya existe no lo toca)
docker compose up -d postgres

cd backend && ./mvnw spring-boot:run          # http://localhost:8080 (lee ../.env)
cd frontend && nvm use && npm ci && npm start # http://localhost:4200 (proxy de /api al backend)
```

Flyway crea el esquema y carga los datos de demostración al arrancar.

## 5. Tests y CI

```bash
cd backend  && ./mvnw verify       # 112 tests: unitarios, integración (Testcontainers) y E2E de API
cd frontend && npm run test:ci     # 74 tests unitarios (Vitest)

# E2E de interfaz (Playwright, Chromium con micrófono simulado) contra el stack de Docker.
# La suite completa espera las respuestas deterministas del proveedor simulado:
LLM_PROVIDER=mock STT_PROVIDER=mock docker compose up -d --build
cd frontend && npx playwright install chromium && E2E_BASE_URL=http://localhost:8080 npm run e2e   # suite completa

# Solo el recorrido del enunciado (01–06), también con el proveedor real (docker compose up -d --build, sin variables):
E2E_BASE_URL=http://localhost:8080 npm run e2e:poc
```

> Los E2E hacen muchas peticiones seguidas: en `.env` sube los límites (`RATE_LIMIT_*_PER_MINUTE=1000`), como hace
> la CI. Necesitan Docker en la máquina (reinician las conversaciones entre tests). Con un proveedor real, `e2e:poc`
> usa aserciones semánticas (insignias grounded) en lugar de las frases fijas del mock. Al terminar, vuelve al
> proveedor real con `docker compose up -d`.

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
│  · TutorStore (estado) │                                │ tutor     LlmPort ───────────┼──▶ Gemini / Groq / Mistral / mock
│  · MediaRecorder (voz) │                                │ speech    TranscriptionPort ─┼──▶ Gemini / Whisper / Voxtral / mock
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
- **Credenciales**: BCrypt; secretos solo por variables de entorno; `.env` fuera de git; clave del proveedor de IA solo en el
  backend y enmascarada en logs.
- **Abuso**: límite de peticiones (login por IP; IA y voz por alumno), validación de tamaño y formato real del audio.

## Estructura

```
.
├── backend/              Spring Boot (auth, catalog, tutor, speech, shared) + Flyway (db/migration, db/seed)
├── frontend/             Angular (core, features, shared) + e2e/ (Playwright) + nginx/
├── docs/                 DECISIONS.md · DEMO.md · DESIGN.md
├── scripts/              setup.sh · setup.ps1 (crean .env la primera vez)
├── .github/workflows/    CI
├── docker-compose.yml    PostgreSQL + backend + frontend
└── .env.example          Variables de entorno (sin secretos)
```

Las credenciales de prueba son ficticias y exclusivas de la demo (`backend/src/main/resources/db/seed`).

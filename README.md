# POC LMS — Tutor virtual con IA y voz

Prueba de concepto: un alumno autorizado abre una lección y pregunta al tutor IA por texto o voz. El tutor responde
basándose en el contenido de la lección (o indica que no tiene información suficiente) y la respuesta puede escucharse.
El historial se conserva por alumno y lección.

> Estado: **en construcción** — estructura del repositorio, base de datos y modelo de datos listos.

## Estructura

```
.
├── backend/            Spring Boot 4 · Java 25 · PostgreSQL · Flyway
├── frontend/           Angular + Tailwind (pendiente)
├── docs/DESIGN.md      Guía de diseño y plataformas de referencia
├── docker-compose.yml  PostgreSQL para desarrollo
└── .env.example        Variables de entorno (copiar a .env)
```

## Requisitos

- JDK 25 (p. ej. Eclipse Temurin 25 o `java-25-openjdk-devel` en Fedora)
- Docker + Docker Compose (también lo usan los tests vía Testcontainers)
- Node 22+ (frontend, pendiente)

## Puesta en marcha (backend)

```bash
cp .env.example .env
# Edita .env: define DB_PASSWORD y JWT_SECRET (obligatorio, genera uno con: openssl rand -base64 48)
docker compose up -d postgres
cd backend && ./mvnw spring-boot:run
```

Flyway crea el esquema y carga los datos de demostración al arrancar. Sin `JWT_SECRET` (≥ 32 bytes) la aplicación
no arranca, a propósito.

## API

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/login` | público | `{email, password}` → `{accessToken, tokenType, expiresAt, student}` |
| `GET` | `/api/auth/me` | Bearer | Perfil del alumno del token |
| `GET` | `/api/courses` | Bearer | Cursos en los que está matriculado el alumno |
| `GET` | `/api/courses/{id}` | Bearer + matrícula | Curso con su temario |
| `GET` | `/api/lessons/{id}` | Bearer + matrícula | Lección completa (Markdown) con navegación anterior/siguiente |
| `GET` | `/api/lessons/{id}/messages` | Bearer + matrícula | Historial del alumno en esa lección (solo el suyo) |
| `POST` | `/api/lessons/{id}/messages` | Bearer + matrícula | `{content, inputMode: TEXT\|VOICE}` → `{question, answer}`; `answer.grounded` indica si se basa en la lección |
| `GET` | `/actuator/health` | público | Estado del servicio |

Un recurso sin acceso responde **404, igual que uno inexistente**, para no revelar qué ids son válidos (prevención
de IDOR y enumeración). La identidad del alumno sale siempre del token, nunca de la URL ni del cuerpo.

Los errores siguen RFC 9457 (`application/problem+json`) con un campo `code` estable
(`INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `VALIDATION_FAILED`, ...).

```bash
curl -s localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ana.garcia@demo.edtech","password":"Demo1234!"}'
```

## Proveedor de IA

| `LLM_PROVIDER` | Comportamiento |
|---|---|
| `mock` (por defecto) | Sin clave. Responde con la sección de la lección más relacionada con la pregunta o indica que no hay información suficiente. Incluir `#simular-fallo` en la pregunta simula una caída del servicio de IA (HTTP 503 `AI_UNAVAILABLE`) para demostrar la recuperación de errores. |
| `groq` | Modelo real vía Groq (requiere `GROQ_API_KEY`; modelo configurable con `GROQ_MODEL`, por defecto `llama-3.3-70b-versatile`). La app no arranca si falta la clave. |

Resiliencia con el proveedor real: timeouts (3 s de conexión, 15 s de lectura), **un reintento** con backoff solo
ante fallos transitorios (timeout, 429, 5xx, salida no válida) y **circuit breaker** (si fallan ≥ 50 % de las
últimas llamadas, responde `AI_UNAVAILABLE` al instante durante 30 s en vez de hacer esperar al alumno).

## Tests

```bash
cd backend && ./mvnw test       # levanta un PostgreSQL efímero con Testcontainers
```

| Tipo | Qué cubre |
|---|---|
| Unitarios | `PromptBuilder` (grounding, neutralización de inyección de prompt), adaptador mock |
| Integración (MockMvc) | Seguridad JWT, CORS, catálogo, tutor, validación, IDOR entre alumnos |
| **E2E de API** (`e2e/`) | Servidor real en puerto aleatorio: login → curso → lección → preguntas (voz/texto, fuera de temario, fallo de IA) → nuevo login → historial; y cuenta sin acceso |

## Usuarios de prueba

| Usuario | Contraseña | Acceso |
|---|---|---|
| `ana.garcia@demo.edtech` | `Demo1234!` | Matriculada en *Fundamentos de APIs REST* |
| `bruno.lopez@demo.edtech` | `Demo1234!` | Sin acceso al curso |

Son credenciales ficticias exclusivas de la demo, cargadas por `backend/src/main/resources/db/seed`.

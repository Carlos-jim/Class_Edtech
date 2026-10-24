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
cp .env.example .env            # ajusta DB_PASSWORD
docker compose up -d postgres
cd backend && ./mvnw spring-boot:run
```

Flyway crea el esquema y carga los datos de demostración al arrancar.

## Tests

```bash
cd backend && ./mvnw test       # levanta un PostgreSQL efímero con Testcontainers
```

## Usuarios de prueba

| Usuario | Contraseña | Acceso |
|---|---|---|
| `ana.garcia@demo.edtech` | `Demo1234!` | Matriculada en *Fundamentos de APIs REST* |
| `bruno.lopez@demo.edtech` | `Demo1234!` | Sin acceso al curso |

Son credenciales ficticias exclusivas de la demo, cargadas por `backend/src/main/resources/db/seed`.

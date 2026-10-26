# Decisiones y límites

Síntesis de las decisiones relevantes de la POC, las alternativas descartadas y lo que queda fuera del alcance.

## 1. Arquitectura

**Monolito modular + puertos y adaptadores donde hay proveedores externos.**

- El backend se organiza por funcionalidad (`auth`, `catalog`, `tutor`, `speech`, `shared`), no por capas técnicas
  globales. Cada módulo contiene su API, aplicación, dominio e infraestructura.
- Microservicios descartados: añadirían red, despliegue y consistencia distribuida sin aportar nada a un recorrido
  acotado, y harían la solución más difícil de explicar.
- La arquitectura hexagonal se aplica **solo** a la IA (`LlmPort`) y a la voz (`TranscriptionPort`), que es donde
  realmente cambia la implementación (mock, Mistral, Groq...). En el resto sería ceremonia.

### Patrones de diseño

| Patrón | Dónde | Para qué |
|---|---|---|
| Ports & Adapters | `LlmPort`, `TranscriptionPort` | El dominio no depende del proveedor; el mock permite tests y CI deterministas, sin claves |
| Strategy + Factory | `LlmConfig`, `SpeechConfig`, `AiProviders` | Elegir proveedor por configuración (`gemini` / `groq` / `mistral` / `mock`) y fallar al arrancar si falta la clave |
| Adapter | `OpenAiCompatibleLlmAdapter`, `OpenAiCompatibleTranscriptionAdapter`, `ChatAudioTranscriptionAdapter`; `AudioRecorder`, `SpeechPlayer` (frontend) | Aislar APIs externas y del navegador, traducir sus errores a errores propios |
| Decorator | `ResilientLlmPort` | Añadir retry y circuit breaker a cualquier `LlmPort` sin modificarlo |
| Facade / Application Service | `TutorService` | Un único punto que orquesta acceso → contexto → IA → persistencia |
| Builder | `PromptBuilder` | Construir el prompt con la lección delimitada y defensas frente a inyección |
| Policy | `AccessPolicy` | Autorización por recurso centralizada y testeable |
| Repository + DTO | Spring Data JPA, `record` en la API | Persistencia parametrizada; las entidades nunca se serializan |
| State (máquina de estados) | `TutorStore` (frontend) | Fases `loading → idle → recording → transcribing → reviewing → sending` con transiciones validadas |
| Interceptor (cadena) | `authInterceptor`, `errorInterceptor` | Token solo hacia `/api`, errores normalizados, sesión caducada → login |
| Page Object | `e2e/pages` | E2E legibles y mantenibles |

## 2. Stack

| Elección | Motivo |
|---|---|
| Spring Boot 4.1 + Java 25 (LTS) | Versiones actuales; records, `ProblemDetail`, Spring Security 7 |
| Angular 22 (standalone, signals, sin zone.js) | Signals encajan con la máquina de estados del tutor; requisito del participante |
| Tailwind 4 | Sistema de diseño propio con tokens (ver `DESIGN.md`) sin una librería de componentes pesada |
| PostgreSQL 17 + Flyway | Migraciones versionadas y datos de demo reproducibles; restricciones de integridad en la BD |
| Google Gemini (`gemini-3.5-flash-lite`, chat y voz) por defecto; Groq y Mistral seleccionables | Gratuito sin tarjeta y accesible desde la red del desarrollador; API compatible con OpenAI (mismos adaptadores) |

## 3. Tutor de IA

**Grounding por contexto completo, sin RAG.** Con dos lecciones de ~3 KB, la lección entera cabe en el prompt. Un RAG
(embeddings + base vectorial) añadiría coste y puntos de fallo sin mejorar la calidad aquí. Si el contenido creciera,
el siguiente paso sería trocear la lección y recuperar fragmentos (p. ej. pgvector) detrás del mismo `PromptBuilder`.

**Salida estructurada `{answer, grounded, citation}`** (modo JSON, `response_format: json_object`). El prompt exige responder solo con la
lección, marcar `grounded=false` cuando no basta y, si afirma estar grounded, devolver una **cita literal** de la
lección. `CitationVerifier` comprueba que la cita aparece en el texto (normalizando Markdown/acentos, con un
respaldo por cobertura de palabras en orden). Si falla, se degrada a `grounded=false` y no se muestra cita. La UI
enseña insignia + bloque «De la lección: …»; así el indicador no depende solo de lo que diga el modelo.

**Inyección de prompt (mitigación, no garantía).** La lección va delimitada en `<leccion>`; pregunta, historial y
lección se declaran como datos; se neutralizan las etiquetas delimitadoras en cualquier texto para que nadie pueda
"cerrar" el bloque. Un LLM puede seguir equivocándose: ver límites.

**Proveedor intercambiable por configuración (Gemini por defecto).** El proveedor inicial era Groq. Durante el
desarrollo empezó a responder `403 Access denied` desde la red del desarrollador (bloqueo de red/región, no de la
clave). Se generalizaron los adaptadores a "API compatible con OpenAI" y se probó Mistral, cuyo plan gratuito dejó de
permitir claves de API en octubre de 2026. Gemini (Google AI Studio) es gratuito, sin tarjeta y accesible desde esa red,
y quedó como proveedor por defecto **tras verificarlo con la clave real** (chat en modo JSON con cita verificada y
transcripción de voz). Un registro (`AiProviders`) asocia cada proveedor con su URL, modelos, variable de clave y vía de
transcripción; cambiar de proveedor —o usar uno para el chat y otro para la voz— es editar `.env`. La aplicación no
arranca si falta la clave del proveedor elegido y el mensaje dice cuál y dónde conseguirla.

**Voz con Gemini: audio por el chat y WAV en el navegador.** Gemini no ofrece `/audio/transcriptions`; su API
compatible acepta audio dentro del chat (`input_audio`), pero solo WAV o MP3 (rechaza el webm de Chrome/Edge y el ogg de
Firefox). `ChatAudioTranscriptionAdapter` envía el audio con la instrucción de transcribirlo literalmente, y el
navegador convierte cada grabación a **WAV 16 kHz mono** (`OfflineAudioContext` + codificador PCM propio) antes de
subirla: es el formato que aceptan todos los proveedores y ocupa ~1,9 MB por minuto. Si el navegador no pudiera
decodificar la grabación, se envía la original.

**Mock solo para tests.** El mock
determinista (`LLM_PROVIDER=mock`) busca la sección de la lección con más palabras clave de la pregunta y, si no hay
coincidencias, responde `grounded=false`; existe para que los tests y la CI sean reproducibles, sin red ni cuota, y
puedan simular una caída (`#simular-fallo`).

**`RestClient` en lugar de Spring AI.** Ya existe el puerto propio, así que la abstracción de Spring AI sobraba;
además su autoconfiguración exige clave al arrancar (incompatible con el modo mock) y se quería control explícito de
timeouts, modo JSON y clasificación de errores.

**Resiliencia.** Timeouts (3 s conexión / 15 s lectura), un reintento con backoff solo ante fallos transitorios (timeout,
429, 5xx, JSON inválido) y circuit breaker (Resilience4j): si el proveedor falla repetidamente se responde
`AI_UNAVAILABLE` al instante en vez de hacer esperar al alumno.

**Historial.** Una conversación por (alumno, lección), garantizada por una restricción única. Pregunta y respuesta se
guardan **juntas y solo si la IA responde**: si falla, no quedan preguntas huérfanas y el reintento no duplica nada. La
llamada al LLM se hace fuera de la transacción para no retener conexiones. Al modelo se le pasan los últimos 10
mensajes como contexto.

## 4. Voz

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Grabar con `MediaRecorder` y transcribir en el backend (Whisper) | Web Speech API (`SpeechRecognition`) | Funciona en Chrome, Firefox, Edge y Safari; calidad de Whisper; la clave del proveedor no sale del servidor |
| Paso de **revisión editable** antes de enviar | Enviar la transcripción directamente | Las transcripciones fallan; el alumno controla lo que pregunta y se respeta "se transcribe antes de enviarse" |
| TTS con `speechSynthesis` del navegador | TTS en la nube | Gratuito, sin latencia de red ni datos a terceros; suficiente para una POC |
| Leer en voz alta automáticamente solo si la pregunta fue por voz | Siempre / nunca | Conversación natural por voz sin molestar a quien escribe; botón *Escuchar* siempre disponible |

Detalles: formato elegido según el navegador (webm/opus o mp4 en Safari) y duración máxima de 60 s (~240 KB); el
backend valida el **formato real por su firma binaria** (no el `Content-Type`), limita a 5 MB y descarta alucinaciones
conocidas de Whisper con silencio («Subtítulos realizados por la comunidad de Amara.org»). Si la transcripción falla
por el servicio o la red, se reintenta con **la misma grabación** (se guarda en memoria). El audio no se almacena.

## 5. Seguridad

| Riesgo | Medida |
|---|---|
| IDOR / acceso indebido | Identidad solo desde el JWT (`@CurrentStudentId`); matrícula comprobada en la propia consulta (`findAccessible`); conversación por (alumno, lección), sin ids en la API; sin acceso → **404 idéntico a inexistente** (no se puede enumerar). Tests con una segunda alumna matriculada que comparte lección. |
| XSS | Markdown: `marked` (HTML crudo escapado) → DOMPurify → saneado de Angular, sin `bypassSecurityTrust*`. Chat siempre interpolado. CSP `script-src 'self'`. Tests unitarios y E2E con cargas maliciosas. |
| Inyección SQL | JPA / JPQL parametrizado; la única consulta nativa usa parámetros. Ids tipados como UUID (un id manipulado da 400). |
| Credenciales | BCrypt; JWT HS256 con secreto ≥ 32 bytes obligatorio (si no, no arranca); `.env` fuera de git; clave del proveedor de IA solo en el backend y enmascarada en logs; CI con secretos efímeros. |
| Fuerza bruta / abuso de cuota | Rate limit: login por IP, preguntas y transcripciones por alumno (429 + `Retry-After`). Mismo mensaje para correo inexistente y contraseña errónea. |
| CSRF | Desactivado de forma consciente: no hay cookies de sesión; el token va en `Authorization`. |
| CORS | Solo orígenes configurados, nunca `*`. En Docker la SPA y la API comparten origen a través de nginx. |
| Cabeceras | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: microphone=(self)`. Contenedores sin root; el backend no se publica fuera de la red de Docker. |
| Redirección abierta | `returnUrl` del login solo admite rutas internas. |

## 6. Experiencia de uso

Diseño basado en la referencia visual "acourses" (`DESIGN.md`): contenedor flotante, barra lateral con el temario,
acento naranja, tarjetas redondeadas con ilustraciones pastel propias y el tutor como columna derecha junto al contenido.
De la referencia se toma el lenguaje visual, no sus funciones (calendario, pagos, valoraciones): cada zona muestra datos
reales. El naranja con texto blanco no alcanza el contraste AA, así que los botones naranjas llevan texto oscuro; estados
de voz al estilo de los asistentes de voz (ChatGPT). Estado de la interacción siempre visible y anunciado a lectores de pantalla
(`aria-live`). Cada error tiene un mensaje concreto **y una acción**: *Reintentar*, *Escribir en su lugar*, *Grabar de
nuevo*. Responsive (tres columnas ≥ 1280 px, tutor a pantalla completa en móvil). Accesibilidad auditada con axe-core
(WCAG 2.1 AA) en los E2E; se corrigieron los problemas de contraste y de nombres accesibles que detectó.

## 7. Calidad

- **261 tests** automatizados: 128 en el backend (unitarios, integración con Testcontainers y E2E de API), 80
  unitarios en el frontend (Vitest) y 53 E2E de interfaz (Playwright) contra el stack Docker real en Chromium
  (escritorio y móvil), Firefox y WebKit, con micrófono simulado. Además, 3 E2E opcionales contra la IA real
  (`npm run e2e:live`), fuera de la CI, que usan una pregunta hablada real como micrófono.
- Los tests de seguridad se validaron también "rompiendo" el código a propósito (p. ej. quitar la comprobación de
  matrícula hace fallar los tests de IDOR).
- CI en GitHub Actions: backend → frontend → E2E sobre `docker compose`.
- Los E2E destaparon dos fallos que los tests de integración no veían y que habrían roto el despliegue con Docker
  (CORS detrás de nginx y subidas grandes cortadas por Tomcat); ambos corregidos.

## 8. Límites y aspectos no desarrollados

- **Calidad del grounding**: la cita se verifica contra la lección, pero la *respuesta* no se reescribe frase a frase
  contra el texto. Un modelo podría responder con matices no citados y aun así aportar una cita válida cercana. Mejora
  posible: exigir solapamiento semántico respuesta↔cita o mostrar varias citas.
- **Inyección de prompt**: mitigada, no eliminada (ningún prompt la elimina por completo).
- **Sesión**: JWT de 2 h sin refresh ni revocación (el logout descarta el token en el cliente). Se guarda en
  `sessionStorage`, accesible a JavaScript: la defensa es evitar XSS (CSP + saneado). En producción: cookie
  `HttpOnly` + `SameSite` con refresh token rotatorio.
- **Rate limiting en memoria**: válido para una instancia; con varias réplicas haría falta Redis o el API gateway.
- **Proveedor gratuito**: los planes gratuitos tienen cuotas por minuto/día, picos de demanda (Gemini responde a veces
  503 *high demand*) y condiciones cambiantes (Groq bloquea algunas redes; Mistral retiró las claves gratuitas; en el
  plan gratuito de Gemini, Google puede usar las peticiones para mejorar sus productos). El circuit breaker y los
  mensajes de error lo cubren y se cambia de proveedor desde `.env`, pero no hay conmutación automática a otro
  proveedor.
- **Voz**: la calidad del TTS depende de las voces instaladas en el sistema del alumno. Si no hay ninguna (Linux sin
  `speech-dispatcher`, navegadores Flatpak sin acceso a él) la Web Speech API no da error: simplemente no suena. Se
  detecta con un temporizador (si no empieza a sonar en 3 s) y se avisa al alumno; no hay TTS en servidor de respaldo. En modo mock la transcripción
  devuelve siempre la misma frase. La voz se prueba en Chromium y Firefox con micrófono simulado; en WebKit (Safari) solo el recorrido de texto, porque Playwright no simula el micrófono en ese motor.
- **Respuestas sin streaming**: la respuesta llega completa (indicador "pensando"); con streaming (SSE) se percibiría
  más rápida.
- **Fuera de alcance por el enunciado**: gestión de cursos y matrículas, registro de usuarios, roles de profesor,
  progreso del alumno, internacionalización, observabilidad (métricas/trazas) y despliegue en la nube.
- **Privacidad**: no se guarda el audio; las conversaciones se conservan sin caducidad (en producción: política de
  retención y borrado a petición del alumno).

## 9. Siguientes pasos

1. Streaming de respuestas (SSE).
2. Sesión con cookie `HttpOnly` + refresh token.
3. RAG por fragmentos (pgvector) cuando el catálogo crezca.
4. Métricas (latencia, tasa de `grounded=false`, errores por proveedor) para evaluar la calidad del tutor.
5. Probar la voz en Safari real (iOS/macOS), que Playwright no puede simular.

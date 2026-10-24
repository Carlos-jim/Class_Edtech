# Guía de diseño — POC LMS Tutor IA

Objetivo: interfaz **profesional, sobria y enfocada en el aprendizaje**. Se toman patrones probados de plataformas
reconocidas en lugar de inventar convenciones nuevas.

## Referencias y qué se toma de cada una

| Plataforma | Patrón que se adopta | Dónde se aplica |
|---|---|---|
| **Coursera** | Reproductor de lección con temario lateral (lista numerada de lecciones, la activa resaltada) y breadcrumb `Curso › Lección` | Pantalla de lección |
| **Udemy** | Tarjeta de curso con título, descripción, nº de lecciones y duración estimada; CTA claro "Continuar" | Mis cursos |
| **Khan Academy · Khanmigo** | Tutor IA en **panel lateral junto al contenido**, no en una página aparte: el alumno lee y pregunta sin perder contexto | Panel del tutor |
| **ChatGPT / Gemini (modo voz)** | Botón de micrófono con estados visibles (grabando con temporizador y onda, transcribiendo, respondiendo) y transcripción editable antes de enviar | Interacción por voz |
| **Notion / Linear** | Tipografía limpia, paleta neutra, mucho espacio en blanco, bordes sutiles en lugar de sombras pesadas | Sistema visual global |
| **Stripe Dashboard** | Login centrado y minimalista; mensajes de error concretos y accionables | Login y estados de error |

## Layout

### Escritorio (≥ 1280 px) — tres zonas, inspirado en Coursera + Khanmigo

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ◆ EdTech Tutor        Mis cursos                                    (AG) Ana ▾ │  topbar 56px
├───────────────┬─────────────────────────────────────┬────────────────────────────┤
│ FUNDAMENTOS   │ Fundamentos de APIs REST › Lección 2│  ✦ Tutor IA          ⟲  ✕ │
│ DE APIs REST  │                                     │ ─────────────────────────  │
│               │ Métodos HTTP: GET, POST, PUT…       │  Pregunta sobre esta       │
│ ● 1 Intro...  │ ⏱ 12 min                            │  lección. Respondo solo    │
│ ◉ 2 Métodos   │                                     │  con su contenido.         │
│               │ ## Los métodos HTTP                 │                            │
│               │ Lorem ipsum… (prose, max 72ch)      │  [Tú] ¿Para qué sirve POST?│
│               │                                     │  [Tutor] POST sirve…  🔊   │
│               │                                     │                            │
│               │                                     │ ┌────────────────────────┐ │
│               │                                     │ │ Escribe tu pregunta… 🎙 ➤│ │
│   280px       │          flexible                   │ └────────────────────────┘ │
│               │                                     │         400px              │
└───────────────┴─────────────────────────────────────┴────────────────────────────┘
```

### Tablet / móvil

- `< 1280 px`: el temario pasa a un drawer (botón ☰).
- `< 768 px`: el tutor se abre como **bottom sheet** a pantalla completa desde un botón flotante "Preguntar al tutor".

## Tokens (Tailwind)

### Color

| Rol | Token Tailwind | Uso |
|---|---|---|
| Fondo app | `slate-50` | Lienzo |
| Superficie | `white` + `border-slate-200` | Tarjetas, paneles |
| Texto principal / secundario | `slate-900` / `slate-500` | — |
| Primario (marca) | `indigo-600`, hover `indigo-700`, suave `indigo-50` | CTA, lección activa, burbuja del alumno |
| Basado en la lección | `emerald-600` / `emerald-50` | Badge "Basado en la lección" |
| Fuera del contenido | `amber-600` / `amber-50` | Badge "Sin información suficiente en la lección" |
| Grabando | `rose-600` | Micrófono activo, pulso |
| Error | `red-600` / `red-50` | Alertas con acción "Reintentar" |

Contraste mínimo **WCAG AA** (4.5:1 en texto).

### Tipografía

- UI: **Inter** (400/500/600). Código: **JetBrains Mono**.
- Contenido de la lección: plugin `@tailwindcss/typography` (`prose prose-slate`), ancho máx. `72ch`, `text-base/7`.
- Escala: título de página `text-2xl font-semibold`, sección `text-lg font-semibold`, cuerpo `text-sm`/`text-base`.

### Forma y espacio

- Radios: `rounded-lg` (inputs, botones), `rounded-xl` (tarjetas, paneles), `rounded-2xl` (burbujas de chat).
- Sombras: solo `shadow-sm`; se prioriza el borde `border-slate-200`.
- Espaciado base 4 px; paneles con `p-6`, listas con `gap-2`/`gap-3`.
- Iconos: **Lucide** (trazo 1.5–2 px, consistentes).

## Componentes clave

| Componente | Notas |
|---|---|
| `CourseCard` | Título, descripción (2 líneas), `2 lecciones · 22 min`, botón "Continuar" |
| `LessonSidebar` | Lista numerada; activa con borde izquierdo `indigo-600` y fondo `indigo-50` |
| `LessonContent` | Breadcrumb, título, duración, `prose`. Markdown renderizado **y sanitizado** |
| `TutorPanel` | Cabecera con estado, lista de mensajes con scroll, composer fijo abajo |
| `ChatMessage` | Alumno: derecha, `indigo-600` texto blanco, icono 🎙 si fue por voz. Tutor: izquierda, superficie blanca con borde, badge de grounding y botón 🔊 escuchar |
| `VoiceButton` | Estados: reposo → grabando (rojo, pulso, `00:07`) → transcribiendo (spinner) → revisión (texto editable) |
| `StatusBar` | Línea bajo la cabecera del tutor: "Escuchando…", "Transcribiendo…", "El tutor está pensando…", "Reproduciendo respuesta…" (`aria-live="polite"`) |
| `ErrorBanner` | Mensaje concreto + acción: "Reintentar", "Escribir en su lugar", "Revisar permisos del micrófono" |
| `EmptyState` | Bruno (sin cursos): ilustración simple + "Aún no tienes cursos asignados" |
| `AccessDenied` | Lección sin acceso: "No tienes acceso a esta lección" + volver a Mis cursos (sin revelar detalles) |

## Microinteracciones

- Indicador "escribiendo" del tutor con tres puntos animados (como ChatGPT).
- Auto-scroll al último mensaje; respeta si el usuario ha subido manualmente.
- Transiciones de 150–200 ms (`ease-out`); se respeta `prefers-reduced-motion`.
- Skeletons al cargar lección e historial (no spinners a pantalla completa).

## Accesibilidad

- Todo operable por teclado; foco visible `ring-2 ring-indigo-500 ring-offset-2`.
- `aria-live` para estados del tutor y nuevos mensajes.
- Botones de icono con `aria-label` ("Grabar pregunta por voz", "Escuchar respuesta").
- No depender solo del color: los badges llevan icono + texto.

# Guía de diseño — POC LMS Tutor IA

Objetivo: interfaz **cálida, limpia y profesional**, enfocada en aprender. La referencia visual es un panel de cursos
tipo **"acourses"** (Dribbble): contenedor flotante redondeado, barra lateral blanca, acento naranja, tarjetas muy
redondeadas con ilustraciones pastel y una columna derecha con la agenda.

## De la referencia a la POC

La referencia incluye calendario, pagos, mensajes, valoraciones con estrellas y buscador global. El enunciado pide no
añadir funcionalidades ajenas, así que **se adopta el lenguaje visual y cada zona se rellena con datos reales**:

| Referencia | En la POC |
|---|---|
| Barra lateral: Overview, Courses, Calendar, Payments, Messages, Log Out | **Mis cursos** + **lecciones del curso** (temario navegable) + **Salir** |
| Indicador naranja a la izquierda del elemento activo | Igual: en "Mis cursos" y en la lección abierta |
| Buscador superior | Buscador de cursos en "Mis cursos" (solo aparece si hay más de un curso) |
| Avatar y nombre arriba a la derecha | Iniciales del alumno y nombre; saludo a la izquierda |
| Pestañas All / Active / Upcoming / Completed | Omitidas: no hay estado de progreso en el modelo |
| Tarjeta horizontal: ilustración pastel, título, ★ valoración, descripción, etiquetas, fecha, "View More" | Ilustración pastel propia (SVG), título, **duración**, descripción, etiquetas reales (nº de lecciones, Tutor IA, Texto y voz), "Empieza por la lección 1", **"Empezar curso"** |
| Calendario semanal | Tarjeta **"Tu tutor IA"** (qué hace y cómo) |
| Schedule: número grande, separador, título, "10 of 20 chapters", hora; primera fila elevada | **Temario**: `01`, separador, título, "Lección 1 de 2", duración; primera fila elevada |
| — (no aparece) | Pantalla de lección: contenido en tarjetas a la izquierda y **panel del tutor** como columna derecha |

Las ilustraciones son un SVG propio (`CourseArt`: ventana de navegador con `{ }` y `POST` hacia un servidor) en tres
variantes pastel (amarillo, lavanda, rosa) que alternan como las tarjetas de la referencia. No se usan imágenes de
terceros.

## Layout

### Escritorio (≥ 1280 px)

```
┌──────────────────────────── fondo canvas ─────────────────────────────┐
│ ╭──────────┬─────────────────────────────────────────────────────────╮ │
│ │  (logo)  │ Hola, Ana. Sigue aprendiendo…              (AG) Ana García │
│ │ edtech   │                                                         │ │
│ │  tutor   │ Mis cursos                          │ ╭ Tu tutor IA ──╮ │ │
│ │          │ ╭──────┬───────────────────────────╮ │ ╰───────────────╯ │ │
│ │━ Mis cur.│ │ art  │ Título           ⏱ 22 min │ │ Temario           │ │
│ │          │ │pastel│ descripción…               │ │ ╭ 01 │ Intro… ╮  │ │
│ │ FUNDAM.  │ │      │ [2 lecciones] [Tutor IA]   │ │ ╰─────────────╯  │ │
│ │ 1 Intro  │ │      │ Empieza por…  (Empezar →)  │ │   02 │ Métodos…  │ │
│ │ 2 Métodos│ ╰──────┴───────────────────────────╯ │                   │ │
│ │ ⇥ Salir  │                                                         │ │
│ ╰──────────┴─────────────────────────────────────────────────────────╯ │
└───────────────────────────────────────────────────────────────────────┘
```

En la lección, la zona central tiene dos columnas: **contenido** (cabecera en tarjeta con miniatura ilustrada, cuerpo
en tarjeta blanca, anterior/siguiente) y **tutor IA** (tarjeta blanca de altura completa).

### Tablet y móvil

- `< 1280 px`: sin contenedor flotante; la barra lateral pasa a un **menú desplegable** (botón "Abrir menú").
- `< 1024 px`: el tutor se abre a pantalla completa desde el botón flotante **"Preguntar al tutor"**.
- Las tarjetas de curso apilan la ilustración encima del texto.

## Tokens (Tailwind 4, `src/styles.css`)

### Color

| Rol | Token | Valor / uso |
|---|---|---|
| Fondo exterior | `canvas` | `#eef0f4` |
| Contenedor de la app | `surface` | `#f7f8fa` |
| Tarjetas, barra lateral | `white` + `shadow-soft` | Sombras suaves, sin bordes |
| Marca | `brand-50 … brand-800` | Naranja: `brand-400` `#fdb022` (botones), `brand-500` (iconos, indicador), `brand-700` (texto) |
| Pastel de ilustraciones | `pastel-yellow`, `pastel-lavender`, `pastel-pink` | Fondos de `CourseArt` |
| Texto | `slate-900` / `slate-600` / `slate-500` | Títulos / secundario sobre `surface` / secundario sobre blanco |
| Basado en la lección | `emerald-50/700` | Insignia y cita |
| Sin información suficiente | `amber-50/700` | Insignia |
| Grabando | `rose-*` | Barra de grabación |

**Reglas de contraste (WCAG AA, verificadas con axe-core en los E2E):**

- El naranja de la referencia con **texto blanco no cumple** (≈ 2:1). Los botones naranjas (`btn-primary`) llevan
  **texto oscuro** (`slate-900` sobre `brand-400`, ≈ 9:1), igual que la burbuja del alumno y los avatares.
- Texto naranja sobre blanco: solo `brand-700` (≈ 5:1); sobre el crema `brand-100`, `brand-800`.
- Texto secundario sobre `surface`: `slate-600` (el `slate-500` queda en 4,4:1 sobre ese fondo).

### Tipografía

- UI: **Plus Jakarta Sans** (variable, servida desde la app), geométrica y redondeada como la referencia.
  Código: **JetBrains Mono**.
- Títulos en `font-bold` con `tracking-tight`: página `text-3xl`, tarjeta `text-lg`, lección `text-2xl`.
- Lección: `prose prose-slate`, código con fondo `brand-50`.

### Forma y espacio

- Radios grandes: contenedor `2rem`, tarjetas `rounded-3xl`, ilustraciones y filas `rounded-2xl`, botones y chips
  en píldora (`rounded-full` / `rounded-lg`).
- Sombras: `shadow-soft` (tarjetas) y `shadow-float` (contenedor, hover).
- Iconos: **Lucide** (trazo 2 px).

## Componentes

| Componente | Notas |
|---|---|
| `Shell` + `SidebarNav` | Contenedor flotante; barra lateral con logo, "Mis cursos", lecciones del curso (indicador naranja en la activa) y "Salir" |
| `CourseCard` | Horizontal: `CourseArt`, título, duración, descripción, chips, "Empezar curso" |
| `CourseArt` | SVG decorativo (`aria-hidden`) con tres variantes pastel |
| Temario (columna derecha) | Filas tipo agenda; la primera elevada en blanco |
| `LessonContent` | Ruta de navegación, cabecera en tarjeta con miniatura, cuerpo en tarjeta, anterior/siguiente |
| `TutorPanel` | Tarjeta blanca de altura completa; burbuja del alumno naranja con texto oscuro; insignias de grounding; cita "De la lección" |
| `AlertBanner` | Mensaje concreto + acción ("Reintentar", "Escribir en su lugar", "Grabar de nuevo") |

## Accesibilidad

- Todo operable con teclado (E2E de recorrido solo con teclado); foco visible `ring-brand-700`.
- `aria-live` para los estados del tutor; `aria-current="page"` en el elemento activo de la navegación.
- Iconos decorativos ocultos; botones de icono con `aria-label`; los nombres accesibles contienen el texto visible.
- Auditoría automática WCAG 2.1 AA (axe-core) del login, "Mis cursos" y la lección en cada ejecución de la CI.
- Se respeta `prefers-reduced-motion`.

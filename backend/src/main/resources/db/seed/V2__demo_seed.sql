-- Datos de demostración. Credenciales SOLO para la POC (documentadas en README):
--   ana.garcia@demo.edtech    / Demo1234!  -> matriculada en el curso
--   bruno.lopez@demo.edtech   / Demo1234!  -> SIN acceso al curso
-- IDs fijos para que los tests de acceso (IDOR) sean deterministas.

INSERT INTO student (id, email, password_hash, display_name) VALUES
    ('a1b2c3d4-0000-4000-8000-000000000001', 'ana.garcia@demo.edtech',
     '$2a$10$TZAFAeqqgXfCIR/QcL6Tw.lqR.dlXzeMRIVcF5vrntpEAhFhsJyFi', 'Ana García'),
    ('a1b2c3d4-0000-4000-8000-000000000002', 'bruno.lopez@demo.edtech',
     '$2a$10$TZAFAeqqgXfCIR/QcL6Tw.lqR.dlXzeMRIVcF5vrntpEAhFhsJyFi', 'Bruno López');

INSERT INTO course (id, slug, title, description) VALUES
    ('c0000000-0000-4000-8000-000000000001', 'fundamentos-apis-rest',
     'Fundamentos de APIs REST',
     'Aprende qué es una API REST, cómo se modelan los recursos y cómo se usan los métodos HTTP para construir servicios web claros y predecibles.');

INSERT INTO lesson (id, course_id, position, title, summary, estimated_minutes, content) VALUES
(
    'e0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    1,
    'Introducción a las APIs REST',
    'Qué es una API, el modelo cliente-servidor y los principios que definen el estilo REST.',
    10,
$md$
## ¿Qué es una API?

Una **API** (*Application Programming Interface*) es un contrato que define cómo un programa puede pedir datos o acciones a otro. En la web, ese contrato suele exponerse mediante **HTTP**: un **cliente** (por ejemplo, una aplicación móvil o un navegador) envía una **petición** y un **servidor** devuelve una **respuesta**.

## ¿Qué significa REST?

**REST** (*Representational State Transfer*) es un estilo de arquitectura propuesto por Roy Fielding en el año 2000. No es un protocolo ni un estándar, sino un conjunto de principios:

1. **Cliente-servidor**: el cliente se ocupa de la interfaz y el servidor de los datos y la lógica. Pueden evolucionar por separado.
2. **Sin estado (stateless)**: cada petición contiene toda la información necesaria para procesarla. El servidor no guarda el contexto de la sesión del cliente entre peticiones.
3. **Cacheable**: las respuestas indican si pueden almacenarse en caché, lo que mejora el rendimiento.
4. **Interfaz uniforme**: los recursos se identifican con URIs y se manipulan mediante representaciones y métodos HTTP estándar.
5. **Sistema en capas**: entre cliente y servidor puede haber intermediarios (proxies, balanceadores) sin que el cliente lo note.

## Recursos y URIs

En REST todo gira en torno a los **recursos**: cualquier entidad que tenga sentido nombrar, como un usuario, un pedido o un producto. Cada recurso se identifica con una **URI**:

- `/usuarios` — la colección de usuarios.
- `/usuarios/42` — el usuario con identificador 42.
- `/usuarios/42/pedidos` — los pedidos de ese usuario.

Buenas prácticas: usar **sustantivos en plural**, no verbos (`/pedidos`, no `/obtenerPedidos`), y reflejar la jerarquía entre recursos.

## Representaciones

El servidor no envía el recurso en sí, sino una **representación** de su estado. El formato más común es **JSON**:

```json
{
  "id": 42,
  "nombre": "Ana",
  "email": "ana@example.com"
}
```

El cliente indica el formato que acepta con la cabecera `Accept` y el servidor indica el formato enviado con `Content-Type`.

## Códigos de estado

Cada respuesta incluye un **código de estado** que resume el resultado:

- **2xx — Éxito**: `200 OK`, `201 Created`, `204 No Content`.
- **4xx — Error del cliente**: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **5xx — Error del servidor**: `500 Internal Server Error`, `503 Service Unavailable`.

## Resumen

Una API REST expone **recursos** identificados por **URIs**, intercambia **representaciones** (normalmente JSON), es **sin estado** y comunica el resultado de cada operación mediante **códigos de estado** HTTP. En la siguiente lección veremos los **métodos HTTP** que se usan para operar sobre esos recursos.
$md$
),
(
    'e0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000001',
    2,
    'Métodos HTTP: GET, POST, PUT, PATCH y DELETE',
    'Para qué sirve cada método HTTP, qué significa que sea seguro o idempotente y qué respuesta devolver.',
    12,
$md$
## Los métodos HTTP

Los **métodos** (o verbos) HTTP indican **qué acción** se quiere realizar sobre un recurso. La URI dice *sobre qué*; el método dice *qué hacer*.

### GET — Leer

Sirve para **obtener** la representación de un recurso o de una colección. No debe modificar nada en el servidor.

- `GET /productos` → lista de productos.
- `GET /productos/7` → el producto 7.
- Respuesta típica: `200 OK`, o `404 Not Found` si no existe.

### POST — Crear

Sirve para **crear un nuevo recurso** dentro de una colección. El cliente envía los datos en el cuerpo de la petición y el servidor asigna el identificador.

```http
POST /productos
Content-Type: application/json

{ "nombre": "Teclado", "precio": 49.90 }
```

- Respuesta típica: `201 Created`, con la cabecera `Location: /productos/8` que indica la URI del recurso creado.
- POST **no es idempotente**: si se envía la misma petición dos veces, normalmente se crean **dos** recursos distintos.
- También se usa para operaciones que no encajan en otros métodos, como procesar un pago o lanzar una acción (`POST /pedidos/15/cancelacion`).

### PUT — Reemplazar

Sirve para **reemplazar por completo** un recurso existente con la representación enviada. Si un campo no se envía, se considera que debe quedar vacío o con su valor por defecto.

- `PUT /productos/7` con el producto completo.
- Respuesta típica: `200 OK` o `204 No Content`.
- PUT **es idempotente**: repetir la misma petición deja el recurso en el mismo estado.

### PATCH — Modificar parcialmente

Sirve para **actualizar solo algunos campos** de un recurso.

```http
PATCH /productos/7
Content-Type: application/json

{ "precio": 44.90 }
```

- Respuesta típica: `200 OK` o `204 No Content`.

### DELETE — Eliminar

Sirve para **borrar** un recurso.

- `DELETE /productos/7`.
- Respuesta típica: `204 No Content`; si el recurso ya no existe, `404 Not Found`.
- DELETE **es idempotente**: borrar dos veces deja el sistema en el mismo estado (el recurso no existe).

## Seguridad e idempotencia

| Método | Seguro (no modifica) | Idempotente | Uso principal          |
|--------|----------------------|-------------|------------------------|
| GET    | Sí                   | Sí          | Leer                   |
| POST   | No                   | No          | Crear / ejecutar acción |
| PUT    | No                   | Sí          | Reemplazar             |
| PATCH  | No                   | No (en general) | Modificar parcialmente |
| DELETE | No                   | Sí          | Eliminar               |

- **Seguro**: no cambia el estado del servidor.
- **Idempotente**: hacer la petición una vez o varias produce el mismo efecto final. Esto importa cuando hay que **reintentar** una petición tras un fallo de red: reintentar un PUT o un DELETE es seguro; reintentar un POST puede duplicar datos.

## Errores comunes

- Usar `GET` para acciones que modifican datos (por ejemplo, `GET /borrarProducto?id=7`).
- Devolver `200 OK` con un mensaje de error en el cuerpo en lugar del código de estado adecuado.
- Usar `POST` para todo, perdiendo la semántica que aportan los demás métodos.

## Resumen

Elige el método según la intención: **GET** para leer, **POST** para crear, **PUT** para reemplazar, **PATCH** para modificar parcialmente y **DELETE** para eliminar. Conocer qué métodos son seguros e idempotentes ayuda a diseñar APIs predecibles y a gestionar los reintentos.
$md$
);

-- Ana tiene acceso al curso; Bruno no (no tiene matrícula).
INSERT INTO enrollment (student_id, course_id) VALUES
    ('a1b2c3d4-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001');

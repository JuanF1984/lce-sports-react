# Flujo de inscripción

## Rutas involucradas

- `/formulario` y `/formulario/:eventoSlug` → `src/components/pages/inscripciones/SeleccionInscripcion.jsx`
  (definidas en `src/App.jsx`). Es un **wizard con un solo route**: todos los pasos se manejan con
  estado de React (`paso`), no con sub-rutas. Esto importa para el botón "atrás" (ver más abajo).
- Puntos de entrada al flujo: `ProximoEvento.jsx` (home) e `InscriptionButton.jsx`, ambos hacen
  `navigate('/formulario/${slug}')` tras un modal de confirmación.

## Componentes del wizard (en orden)

1. **`SeleccionInscripcion.jsx`** — carga el evento por `slug`, evalúa si la inscripción está
   abierta (ver `docs/eventos.md`) y renderiza el paso `'tipo'` (Individual / Equipo). Para eventos
   `tipo = 'presentacion'` salta directo a `'datos'` con `tipoInscripcion = 'individual'`.
2. **`SeleccionJuego.jsx`** (paso `'juego'`, solo torneos) — elige juego principal y, si el evento
   tiene juegos secundarios, hasta 3 en orden de preferencia (o 1 si ya hay principal).
3. **`Formulario.jsx`** / **`FormularioEquipo.jsx`** (paso `'datos'`) — datos de contacto
   (individual o del capitán + miembros del equipo).
4. **`VerificacionSteam.jsx`** (paso `'steam'`, solo si algún juego elegido tiene
   `verifyType: 'steam'` en `src/data/gameConfig.js`, hoy CS2).
5. **`VerificacionRiot.jsx`** (paso `'riot'`, solo si algún juego elegido tiene
   `verifyType: 'riot'`, hoy LoL/Valorant).
6. **`Confirmacion.jsx`** / **`ConfirmacionEquipo.jsx`** (paso `'confirmacion'`) — hace el/los
   `insert` en Supabase apenas se monta (via `useEffect` + un flag para evitar dobles inserts en
   StrictMode) y muestra el resultado.

`SeleccionInscripcion.jsx` decide el siguiente paso según qué juegos requieren verificación
(`siguientePasoTrasDatos` / `siguientePasoTrasSteam`), y **para presentaciones se fuerza
`'confirmacion'` directo tras `'datos'`**, sin pasar por juego/steam/riot.

## Consultas a Supabase por paso

| Paso | Tabla(s) | Operación |
|---|---|---|
| Carga inicial | `events` | `select('*').eq('slug', eventoSlug).single()` |
| Carga inicial | `event_games` (join `games`), `event_games_days` | `select` vía `useEventGames` |
| `Formulario` / `FormularioEquipo` / `VerificacionSteam` / `VerificacionRiot` | `events` | **Re-fetch** por `id` vía `useEventoSeleccionado(eventoId)` (hook separado, duplica la consulta ya hecha en `SeleccionInscripcion`) |
| `Confirmacion` (individual) | `inscriptions`, `games_inscriptions` | `insert` + `update` (para `qr_code`) |
| `ConfirmacionEquipo` | `inscriptions` (una fila por capitán + una por jugador), `games_inscriptions` | `insert` + `update` por cada fila |
| `Confirmacion` / `ConfirmacionEquipo` | — | Envío de email best-effort vía `enviarConfirmacionIndividual` / `enviarConfirmacionEquipo` (`src/utils/emailService.js`) — **se omite si `eventoSeleccionado.tipo === 'presentacion'`** |

## Validaciones

- Email: formato estricto (`src/lib/email/validateEmail.js`) + bloqueo de local-parts no ASCII +
  chequeo contra `invalid_emails` (según el spec original en `claude/commands/inscripcion-presentaciones.md`).
- Teléfono: `validatePhone` (8-15 dígitos).
- Edad: solo dígitos, `validateAge`.
- Repetir email: debe coincidir con el email ingresado (validación solo de UI, no se persiste).

## Redirecciones a `/` (home)

Búsqueda exhaustiva en todo `src/` de los únicos lugares que pueden mandar a un usuario a `/`
durante el flujo de inscripción:

1. **`SeleccionInscripcion.jsx`**, efecto que carga el evento por slug:
   - Si `eventoSlug` no viene en la URL → `navigate('/')`.
   - Si la consulta a `events` devuelve `error` o `!data` → `navigate('/')` **sin mostrar ningún
     mensaje al usuario ni dejar rastro más que en la consola** (esto se corrigió parcialmente,
     ver "Cambio aplicado" más abajo).
   - Cualquier excepción no controlada en el `try` → mismo `navigate('/')` silencioso.
2. **Header (`Header.jsx`), botón "←" de las páginas internas** (`isInnerPage` = ruta empieza con
   `/formulario`): si el paso actual no registró un `backHandler` propio (contexto
   `BackHandlerContext`), el back cae a `navigate(-1)`. Como todo el wizard vive en **una sola
   entrada de historial** (`/formulario/:slug`), `navigate(-1)` no vuelve al paso anterior del
   wizard — vuelve a lo que había en el historial del navegador antes de entrar al flujo, que
   normalmente es la Home.
   - Los pasos `SeleccionJuego`, `Formulario`, `FormularioEquipo`, `VerificacionSteam` y
     `VerificacionRiot` sí registran su propio `backHandler` (ver el patrón
     `useEffect(() => { setBackHandler(() => onBack); return () => setBackHandler(null); }, [onBack])`).
   - **`Confirmacion.jsx` y `ConfirmacionEquipo.jsx` no registran `backHandler`.** Mientras el
     usuario está en la pantalla final, tocar el botón "←" del header lo manda a Home vía
     `navigate(-1)`, incluso si la inscripción ya se guardó con éxito. Esto es preexistente (no fue
     introducido por la feature de presentaciones — ya estaba así desde los commits `02692bf` /
     `297e37d`, muy anteriores) y no se tocó en esta revisión porque no está claro que sea
     "incorrecto" — es la última pantalla del wizard, no hay a dónde volver dentro del flujo — pero
     es el único lugar del código, aparte del punto 1, donde un usuario puede terminar en Home en
     medio/al final de una inscripción. Si se reporta que el problema ocurre específicamente **al
     tocar la flecha de "atrás"** en la pantalla de confirmación, es este el mecanismo.

## Errores esperables

- `insertError` al guardar en `inscriptions` / `games_inscriptions`: se atrapa y se muestra
  `"Hubo un error al guardar tu inscripción. Intentá de nuevo."` en la misma pantalla de
  confirmación (no hay redirect en este caso).
- Error de envío de email: se atrapa aparte (`catch` propio) y **no afecta el resultado de la
  inscripción** — el email es best-effort.
- Error al cargar el evento por slug (ver arriba): sí redirige a Home.

### Comportamiento cuando el evento no puede cargarse por slug

Confirmado como causa raíz real (ver `docs/eventos.md`): si el fetch por `slug` devolvía 2+ filas
(slug duplicado) o 0 filas, `.single()` fallaba con `PGRST116`, el código redirigía a Home, **pero
el componente todavía alcanzaba a renderizar una vez más** con `eventoSeleccionado` en `null` antes
de que la navegación terminara de aplicarse — y ese render accedía a
`eventoSeleccionado.fecha_inicio` sin optional chaining, tirando
`TypeError: Cannot read properties of null (reading 'fecha_inicio')` en consola.

Corregido en esta revisión: `SeleccionInscripcion.jsx` ahora corta el render con un
`if (!eventoSeleccionado) return null;` inmediatamente después del chequeo de `loading` —
antes de calcular `fechaFinEvento` o renderizar cualquier JSX que asuma que el evento existe. No
cambia el comportamiento observable (el usuario igual termina en Home, porque el `navigate('/')`
ya se disparó en el efecto), solo evita el crash intermedio.

## Relación evento ↔ inscripción

`inscriptions.id_evento` referencia `events.id`. No hay lectura del `tipo` del evento en la tabla
`inscriptions` — el tipo se resuelve siempre a través del evento relacionado, no se duplica.

### Esa misma relación bloquea la eliminación de eventos

La funcionalidad de eliminar eventos (agregada en `EventsList.jsx` en esta revisión, ver
`docs/eventos.md` → "Eliminación de eventos") usa exactamente esta relación para decidir si un
evento se puede borrar: antes del `DELETE` sobre `events`, se hace
`supabase.from('inscriptions').select('id').eq('id_evento', event.id).limit(1)` — si devuelve
alguna fila, se aborta el borrado con el mensaje "No se puede eliminar este evento porque tiene
inscripciones asociadas." y no se llega a ejecutar el `DELETE`. No se cuenta el total de
inscripciones (no hace falta, alcanza con saber que existe al menos una).

## Por qué importa que `slug` sea único

Todo el punto de entrada al wizard depende de que `events.select('*').eq('slug', eventoSlug).single()`
devuelva **exactamente una fila**. Si hay dos eventos con el mismo slug, ese fetch falla siempre
(no es intermitente: pasa el 100% de las veces que alguien entra a ese link) y manda a home a
cualquier usuario que intente inscribirse a cualquiera de los dos eventos involucrados — no solo al
duplicado más nuevo. Ver `docs/eventos.md` (generación de slug + correlativo) y `docs/supabase.md`
(restricción `UNIQUE` pendiente de aplicar) para el detalle completo.

## Cambios aplicados en esta revisión

- En `SeleccionInscripcion.jsx` se agregó `console.error(...)` antes de cada `navigate('/')` del
  efecto de carga por slug, incluyendo el objeto de error real de Supabase. Antes, cualquier motivo
  de fallo (RLS, slug duplicado, columna sin permisos, timeout de red, etc.) se perdía por
  completo: el usuario simplemente aparecía en Home sin ningún indicio de qué pasó, y tampoco
  quedaba nada para diagnosticar del lado del desarrollador.
- En el mismo archivo, `if (!eventoSeleccionado) return null;` para que ese mismo escenario de
  fallo no termine además en un `TypeError` en consola por acceder a propiedades de `null` (ver
  arriba).
- `AddTournamentForm.jsx`: nueva generación de slug con lugar+fecha+tipo y correlativo ante
  colisión (detalle en `docs/eventos.md`), y el submit ahora se bloquea mientras hay un guardado en
  curso (evita altas duplicadas por doble click).
- `EventsList.jsx`: `tipo` pasa a ser de solo lectura al editar, y se agregó la función de eliminar
  eventos sin inscripciones asociadas.

Ninguno de estos cambios altera el comportamiento del flujo público más allá de lo descripto: sigue
yendo a Home ante un fallo de carga del evento, solo que ahora sin el crash intermedio y dejando
registrado el motivo real en consola.

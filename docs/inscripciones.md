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

## Modalidad de inscripción por juego (`event_games.registration_mode`)

Columna `text`, `nullable`, agregada manualmente en Supabase (ver `docs/supabase.md`), con un
`CHECK` que permite `individual | team | both | NULL`. Vive en `event_games`, no en `games` — la
modalidad es de la **combinación juego + evento**, no del juego en general. El mismo juego (p. ej.
CS2) puede ser `team` en un evento y `both` en otro.

- **`individual`**: no se ofrece elección de modalidad; el juego solo aparece en el flujo
  individual (`Formulario.jsx`).
- **`team`**: no se ofrece inscripción individual; el juego solo aparece en el flujo de equipo
  (`FormularioEquipo.jsx`).
- **`both`**: se mantiene la elección entre individual y equipo, con el flujo que ya existía antes
  de esta modificación (nada nuevo).
- **`NULL`** (registros históricos, no migrados a propósito): ver fallback más abajo.

### Dónde se resuelve en el flujo público

La resolución vive en `src/utils/registrationMode.js` (`getEffectiveRegistrationMode`,
`permiteIndividual`, `permiteEquipo`) y se aplica en `SeleccionInscripcion.jsx`:

- `hayJuegosIndividual` / `hayJuegosEquipo` deciden si se muestran las cards "Individual" /
  "Equipo" en el paso `'tipo'` (antes, "Individual" se mostraba siempre incondicionalmente; ahora
  se oculta si **ningún** juego del evento admite modalidad individual — evento 100% `team`).
- `gamesDisponibles` en el paso `'juego'` filtra la lista de juegos ofrecidos según el
  `tipoInscripcion` ya elegido: si es `'individual'`, solo juegos con `permiteIndividual`
  (`individual` o `both`); si es `'equipo'`, solo juegos con `permiteEquipo` (`team` o `both`).

**Importante sobre el orden de pantallas**: el wizard sigue eligiendo primero "Individual/Equipo"
(paso `'tipo'`) y recién después el juego puntual (paso `'juego'`) — no se invirtió ese orden ni se
armó un sistema nuevo, tal como se pidió. La consulta a `registration_mode` ocurre igual, solo que
se aplica como filtro de qué juegos quedan disponibles en cada rama, en vez de decidir la modalidad
después de elegir el juego. El resultado final es equivalente: un juego `team` nunca puede
terminar en el flujo individual, y viceversa.

### Fallback para `registration_mode = NULL` (compatibilidad histórica)

**No se migran registros existentes.** Para `event_games` con `registration_mode = NULL`, el
comportamiento debe ser idéntico al que había antes de esta feature, que dependía de
`games.team_option`:

- Antes de esta revisión, un juego con `team_option = true` se mostraba **tanto en el flujo
  individual como en el de equipo** (no existía un modo "solo equipo"). Es decir, se comportaba
  como `both`, **no** como `team`.
- Un juego con `team_option = false` solo se mostraba en el flujo individual — se comportaba como
  `individual`.

`getEffectiveRegistrationMode(game)` replica exactamente esto:

```js
registration_mode ?? (team_option ? 'both' : 'individual')
```

Ningún evento/juego histórico cambia de comportamiento: los que ya eran "team_option=true" siguen
ofreciendo ambas modalidades, y los "team_option=false" siguen siendo solo individuales.

### Configuración desde el admin

- **`AddTournamentForm.jsx`** (alta de evento): por cada juego seleccionado con
  `team_option = true`, aparece un `<select>` con "Individual" / "Solo equipos" / "Individual o
  equipos" (default `both`, para que un evento nuevo se comporte igual que el histórico si el
  admin no toca nada). Si `team_option = false`, no se muestra selector — se guarda
  `registration_mode = 'individual'` sin depender de ningún estado de UI.
- **`EventsList.jsx` → `EditEventModal`** (edición): mismo selector, mismas reglas — con el
  agregado de la restricción de la siguiente sección.

### Restricción para editar la modalidad con inscripciones existentes

**Relación real usada para decidirlo** (no hay columna que conecte `games_inscriptions`
directamente con `event_games`): `inscriptions.id_evento = events.id`, y
`games_inscriptions(id_inscription, id_game)` conecta cada inscripción con el juego elegido. Para
saber si un `event_games` puntual (evento + juego) ya tiene participantes:

1. Traer los `id` de `inscriptions` donde `id_evento = <id del evento>`.
2. Traer los `id_game` de `games_inscriptions` donde `id_inscription` esté en ese set.
3. El juego está "bloqueado" si su `id` aparece en ese segundo resultado.

Implementado en `getGamesConInscripcionesDelEvento(eventId)` (`EventsList.jsx`), reutilizada en dos
momentos:

- **Al abrir el modal de edición** (`abrirEdicion`): calcula qué juegos del evento ya tienen
  inscripciones y deshabilita su selector de modalidad, con el tooltip/mensaje "Ya tiene
  inscripciones — la modalidad no se puede modificar." Si la verificación en sí falla (error de
  red/RLS), **no se asume que es seguro editar**: se bloquean todos los selectores de modalidad del
  modal hasta que se pueda verificar (fail-closed, no fail-open).
- **Al guardar** (`saveChanges`), como chequeo autoritativo e independiente de lo que haya mostrado
  la UI (mismo patrón de "defensa en profundidad" que ya se usa para el borrado de eventos): se
  vuelve a calcular en ese momento y, si algún juego seleccionado cambió de modalidad efectiva
  respecto a la guardada y ya tiene inscripciones, se frena **todo el guardado** (no se aplica
  ningún cambio parcial) con el mensaje `No se puede modificar la modalidad de "<juego>" porque ya
  tiene inscripciones asociadas.`.

### Restricción para quitar un juego con inscripciones existentes del evento

**Regla:** un juego asociado a un evento no puede quitarse si existen inscripciones de ese juego
dentro de ese evento. Cierra el hueco que quedaba abierto tras la restricción de modalidad de
arriba: antes de este cambio, un juego con inscripciones no podía cambiar de modalidad, pero sí se
podía destildar por completo y sacarlo del evento — dejando esas inscripciones "huérfanas" (el
juego ya no figuraría entre los `event_games` del evento, aunque la inscripción y su
`games_inscriptions` siguieran existiendo).

Usa **la misma relación real** que la restricción de modalidad (no hay columna que conecte
`games_inscriptions` directamente con `event_games`): `inscriptions.id_evento = events.id` +
`games_inscriptions.id_game`. Reutiliza el mismo `getGamesConInscripcionesDelEvento(eventId)`, sin
lógica duplicada:

- **En el modal de edición**: el checkbox de un juego con inscripciones queda `disabled` (no se
  puede destildar), sigue mostrándose tildado y visible como juego asociado, y se agrega el
  hint "No se puede quitar este juego porque ya tiene inscripciones asociadas." (más "ni cambiar su
  modalidad" si además admite equipo). Mientras la verificación está en curso o si falla, el
  checkbox también queda bloqueado — mismo criterio *fail-closed* que la modalidad: si no se puede
  confirmar que un juego no tiene inscripciones, no se permite quitarlo.
- **Al guardar** (`saveChanges`): chequeo autoritativo independiente de la UI. Compara los juegos
  que estaban asociados al evento contra los que quedaron tildados; si alguno de los que se está
  sacando tiene inscripciones, se frena **todo el guardado** (no se aplica ningún cambio parcial)
  con el mensaje `No se puede quitar "<juego>" del evento porque ya tiene inscripciones
  asociadas.`. Si la propia verificación (`getGamesConInscripcionesDelEvento`) falla, la excepción
  se propaga al `catch` general de `saveChanges` y el guardado completo se aborta con el mensaje de
  error genérico — nada se persiste, consistente con fail-closed.

**Alcance de estas dos restricciones combinadas**: un juego con al menos una inscripción en ese
evento no puede cambiar de modalidad ni quitarse del evento. Sí puede seguir agregándose/quitando
libremente cualquier juego **sin** inscripciones, y el resto de los campos del evento (fecha,
localidad, `visible_en_home`, etc.) se editan sin restricciones nuevas.

## Consultas a Supabase por paso

| Paso | Tabla(s) | Operación |
|---|---|---|
| Carga inicial | `events` | `select('*').eq('slug', eventoSlug).single()` |
| Carga inicial | `event_games` (join `games`), `event_games_days` | `select` vía `useEventGames` (incluye `registration_mode`) |
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

### Cambios de esta segunda revisión (nombre del evento + modalidad por juego)

- `events.nombre` (opcional) se agregó a los hooks de lectura y a los formularios de alta/edición
  de evento, y se muestra como título principal (con `localidad` como contexto) en todos los
  lugares donde se presenta un evento — ver el detalle completo en `docs/eventos.md`.
- `event_games.registration_mode` (`individual | team | both | NULL`) se agregó a `useEventGames`,
  a los formularios de alta/edición de evento (selector por juego, solo si `team_option = true`), y
  al flujo público (`SeleccionInscripcion.jsx` filtra juegos disponibles según la modalidad
  efectiva). Ver toda la sección "Modalidad de inscripción por juego" más arriba.
- Se agregó la restricción para no permitir cambiar la modalidad de un juego que ya tiene
  inscripciones, con doble chequeo (al abrir el modal de edición y, de nuevo, al guardar).
- **No se tocó**: el esquema de `games`, la estructura ni el propósito de `event_games_days`
  (sigue relacionándose con `event_games.id` exactamente igual que antes — un `event_game` puede
  tener uno o varios registros de días sin importar su modalidad), ni se migró ningún registro
  histórico de `registration_mode`.

### Cambios de esta tercera revisión (bloqueo de quitar un juego con inscripciones)

- Se agregó la restricción **"un juego asociado a un evento no puede quitarse si existen
  inscripciones de ese juego dentro de ese evento"** — ver la sección dedicada más arriba. Cierra
  el hueco que había quedado señalado (no corregido) al final de la revisión anterior.
- Mismo patrón que la restricción de modalidad: bloqueo visual del checkbox en
  `EditEventModal` (fail-closed mientras se verifica o si la verificación falla) + chequeo
  autoritativo independiente en `saveChanges` que frena todo el guardado si detecta que se está
  intentando quitar un juego con inscripciones.
- No se tocó nada de `event_games_days`, `games.team_option`, `registration_mode` en sí, el flujo
  público de inscripción, los slugs, ni se migró ningún dato histórico — todo esto seguía
  funcionando bien y no era parte de este pedido.

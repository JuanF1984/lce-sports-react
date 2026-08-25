# Módulo de Eventos

## Estructura general

Los eventos viven en la tabla `events` de Supabase y se consumen desde el front por medio de tres
hooks distintos, cada uno con un propósito puntual:

| Hook | Uso | Columnas que pide |
|---|---|---|
| `src/hooks/useProximosEventos.jsx` | Listado en la Home (`ProximoEvento.jsx`) | `id, nombre, fecha_inicio, fecha_fin, localidad, hora_inicio, direccion, ubicacion_url, slug, imagen_url, inscripciones_abiertas, tipo` — filtra `visible_en_home = true` y fecha >= hoy |
| `src/hooks/useEvents.jsx` | Listado completo en el panel admin (`EventsList.jsx`, `InscriptionsList.jsx`) | `id, nombre, fecha_inicio, fecha_fin, localidad, hora_inicio, inscripciones_abiertas, tipo, visible_en_home, fecha_cierre_inscripcion, slug` — sin filtro, trae todos los eventos |
| Fetch inline en `SeleccionInscripcion.jsx` | Punto de entrada al flujo de inscripción (`/formulario/:eventoSlug`) | `select('*')` filtrando por `slug`, con `.single()` (incluye `nombre` automáticamente) |

Los "juegos" asociados a un evento están en la tabla intermedia `event_games` (y opcionalmente
`event_games_days` para eventos de varios días), y se leen con `src/hooks/useEventGames.jsx`. Desde
una revisión anterior, `event_games` también carga `registration_mode` (modalidad de inscripción
individual/equipo/ambas para ese juego en ESE evento puntual) — ver el detalle completo en
`docs/inscripciones.md`. Desde esta revisión también carga `cupo_maximo` (cantidad máxima de
personas para ese juego en ESE evento — `NULL` = sin límite, `0` = cerrado) y, vía el RPC
`get_event_game_cupos`, `ocupados`/`disponibles` — ver "Cupos máximos por evento+juego" en
`docs/inscripciones.md`. `AddTournamentForm.jsx` y `EventsList.jsx` → `EditEventModal` configuran el
cupo por juego en el mismo lugar donde ya se configura `registration_mode`.

## Tipos de evento (`events.tipo`)

Desde la migración `20260701_add_event_tipo.sql` (ver `docs/supabase.md`), un evento puede ser:

- **`torneo`** (default): flujo completo — el usuario elige juego(s) principal/secundario,
  eventualmente equipo, y puede requerir verificación de cuenta Steam/Riot según el juego.
- **`presentacion`**: evento informativo/de exhibición (charla, demo). No tiene juegos asociados
  (`event_games` queda vacío para estos eventos) y el flujo de inscripción se reduce a un único
  paso de datos de contacto. Pensado para eventos a los que se accede por link/QR directo el día
  del evento, no para descubrirlos navegando la home.

El tipo se elige **solo al crear** el evento, en `AddTournamentForm.jsx` (`<select name="tipo">`
con las dos opciones). **No existe hoy un tercer tipo "exhibición" separado** — la funcionalidad de
"evento que se muestra pero no asume que tenga inscripción abierta" está cubierta con la
combinación `tipo = 'presentacion'` + `visible_en_home = false` + `inscripciones_abiertas`, no con
un campo booleano dedicado tipo `es_exhibicion` o `permite_inscripcion`.

### El tipo es inmutable después de creado

Desde esta revisión, `EventsList.jsx` → `EditEventModal` muestra el campo "Tipo de evento" como un
`<select disabled>` de solo lectura — no se puede cambiar un evento de `torneo` a `presentacion` ni
viceversa una vez creado. Además, `saveChanges` excluye explícitamente `tipo` del payload que se
manda a `update()`, como segunda barrera por si algún código futuro llegara a modificar ese campo
del formulario.

**Por qué:** cambiar el tipo de un evento que ya tiene `event_games`/inscripciones asociadas deja
datos inconsistentes (p. ej. un evento que pasa a `presentacion` pero conserva juegos asociados, o
uno que pasa a `torneo` sin haber pedido nunca juego). Si se cargó con el tipo equivocado, la única
vía soportada es **eliminarlo y volver a crearlo** (ver "Eliminación de eventos" más abajo) — y solo
se puede eliminar si todavía no tiene inscripciones.

## Nombre propio del evento (`events.nombre`)

Columna `text`, `nullable`, agregada manualmente en Supabase (ver `docs/supabase.md`). Permite
darle a un evento un nombre propio (p. ej. `"San Fernando Gamers"`) independiente de la
`localidad` (p. ej. `"San Fernando"`), que sigue siendo un campo separado y obligatorio.

- **Opcional**: se puede crear y editar un evento sin completarlo.
- **Se guarda como `null`** si se deja vacío al crear el evento (`AddTournamentForm.jsx`,
  siguiendo la misma convención que ya usan `direccion`/`ubicacion_url` ahí). Al editarlo desde
  `EventsList.jsx` → `EditEventModal`, si se borra queda como string vacío `''`, igual que
  `ubicacion_url` en ese mismo formulario — es la convención que ya tenía ese modal para campos de
  texto opcionales, no una nueva.
- **Editable** en cualquier momento desde `EditEventModal`, sin restricciones (a diferencia de
  `tipo`, que si es inmutable).
- **No participa de la generación del slug.** El slug sigue siendo
  `{localidad}-{fecha_inicio}-{tipo}` (+ correlativo), sin `nombre` — ver "Generación de slugs" más
  abajo. Cambiar el nombre nunca puede romper una URL ya compartida.

### Reglas de visualización: nombre vs. localidad

Si `evento.nombre` tiene contenido, se muestra como título/identificación principal del evento, y
`localidad` pasa a mostrarse como dato de contexto/ubicación (no desaparece). Si `nombre` es `null`
o vacío, se mantiene el comportamiento de siempre: `localidad` como identificación principal, sin
ninguna línea vacía ni texto `undefined` de por medio (siempre se chequea `evento.nombre` con un
`if`/ternario antes de renderizar cualquier línea extra).

Lugares actualizados para respetar esta regla:

- **Home** (`ProximoEvento.jsx`): la card de "Próximos eventos" y su modal de confirmación de
  inscripción. Con nombre: `San Fernando Gamers` (título) / `San Fernando` (línea de contexto) /
  fecha. Sin nombre: solo `San Fernando` como título, igual que antes.
- **Modal "Ver detalles"** (`common/EventoModal.jsx`, usado desde todos los pasos del wizard de
  inscripción): con nombre, "Detalles del evento" pasa a ser un eyebrow pequeño y el nombre ocupa
  el título grande; la fila "Localidad" de la lista sigue mostrando `evento.localidad` igual que
  siempre.
- **Barras de estado de una sola línea** en cada paso del wizard (`SeleccionInscripcion.jsx`,
  `SeleccionJuego.jsx`, `Formulario.jsx`, `FormularioEquipo.jsx`, `VerificacionSteam.jsx`,
  `VerificacionRiot.jsx`): usan el helper `tituloEventoCorto(evento)`
  (`src/utils/eventoDisplay.js`), que arma `"{nombre} · {localidad}"` si hay nombre, o solo
  `localidad` si no — pensado para no duplicar la lógica en cada componente.
- **Listado de eventos del admin** (`EventsList.jsx`): la columna "Localidad" muestra el nombre en
  negrita arriba y la localidad como subtítulo gris cuando existe.

## Reglas para mostrar u ocultar la inscripción

Estas reglas viven todas en `SeleccionInscripcion.jsx` (líneas ~106-144) y se evalúan una vez que
el evento fue cargado por `slug`:

1. **Evento vencido**: `fecha_fin` (o `fecha_inicio` si no hay `fecha_fin`) es anterior a hoy →
   pantalla "Este evento ya finalizó".
2. **Cerrado por el admin**: `inscripciones_abiertas === false` → pantalla de cierre.
3. **Cerrado por fecha límite**: `fecha_cierre_inscripcion` no es null y ya pasó → pantalla de
   cierre (mismo mensaje que el punto 2, agrupado bajo `sinCupos`).
4. Ninguna de las anteriores → se muestra el flujo normal.

Importante: **`visible_en_home` no participa en esta lógica**. Solo controla si el evento aparece
listado en la Home (`useProximosEventos`); un evento con `visible_en_home = false` sigue siendo
100% accesible e inscribible por su URL directa `/formulario/:slug`. Esto es intencional (así
funcionan los links de presentaciones que se comparten por QR), pero también significa que
**ocultar un evento de la home no lo "da de baja"** — si se quiere cerrar de verdad hay que tocar
`inscripciones_abiertas` o `fecha_cierre_inscripcion`.

## Campos relevantes de `events` esperados por el código

Ver el detalle completo de columnas en `docs/supabase.md`. Resumen rápido de los campos nuevos
(agregados junto con el tipo `presentacion`):

- `tipo` — `text not null default 'torneo'`, `check (tipo in ('torneo','presentacion'))`.
- `visible_en_home` — `boolean not null default true`.
- `fecha_cierre_inscripcion` — `timestamptz`, nullable.
- `nombre` — `text`, nullable (agregada manualmente en Supabase, sin migración versionada — ver
  `docs/supabase.md`).

## Generación de slugs

### Causa confirmada del bug de julio 2026

En producción existieron dos eventos con el mismo lugar y fecha, y por lo tanto el mismo slug
(el formato viejo era `"<localidad>-<fecha_inicio>"`, sin nada que los diferenciara). El fetch
público hace `.eq('slug', eventoSlug).single()`, y `.single()` de Supabase/PostgREST **exige
exactamente una fila**: con 2 filas devolvía el error `PGRST116`, que el código interpretaba como
"evento no encontrado" y mandaba al usuario de vuelta a la Home a mitad del flujo de inscripción.
Se resolvió manualmente borrando uno de los dos registros duplicados. Los cambios de esta sección
apuntan a que no vuelva a pasar.

### Formato nuevo (solo para eventos creados a partir de esta revisión)

`AddTournamentForm.jsx` ahora genera el slug como:

```text
{lugar-normalizado}-{fecha_inicio}-{tipo}
```

Por ejemplo:

```text
chascomus-2026-08-22-torneo
chascomus-2026-08-22-presentacion
```

**`nombre` no participa de esta fórmula.** El slug se sigue armando solo con lugar + fecha + tipo,
nunca con el nombre propio del evento — así un cambio de nombre (o el hecho de no tener nombre)
nunca afecta la URL pública.

`{tipo}` es el valor real de `events.tipo` (`torneo` o `presentacion` — los mismos dos valores que
ya usa el `check` de la base, no se inventó ninguno nuevo).

### Colisiones y correlativo

Antes de insertar, `generateUniqueSlug(localidad, fecha, tipo)` consulta `events` con
`.like('slug', '<base>%')` y arma el set de slugs ya usados. Si la base (`lugar-fecha-tipo`) ya
existe, prueba `base-2`, `base-3`, etc. hasta encontrar uno libre:

```text
chascomus-2026-08-22-torneo
chascomus-2026-08-22-torneo-2
chascomus-2026-08-22-torneo-3
```

Esto permite tener más de un evento con el mismo lugar+fecha+tipo (p. ej. dos presentaciones el
mismo día en el mismo lugar), cosa que antes no era posible sin pisar el slug.

**Condición de carrera:** esta verificación es de tipo "leer, después escribir" (`check-then-insert`),
no atómica. Si dos altas simultáneas leen el mismo estado de `events` antes de que la primera
termine de insertar, ambas pueden calcular el mismo slug candidato. Para cubrir ese caso,
`handleSubmit` reintenta automáticamente (hasta 5 veces) generando el siguiente correlativo cuando
el insert falla por violación de unicidad (código de error Postgres `23505`) — pero esto **solo
funciona una vez que la restricción `UNIQUE(events.slug)` esté aplicada en la base** (ver
`docs/supabase.md`, sección "Protección en Supabase"). Sin esa restricción, un choque en paralelo
todavía podría colar un duplicado sin que el insert falle.

### El slug es inmutable después de creado

`EditEventModal` (edición de evento en el admin) **nunca tuvo un campo para `slug`** en su
formulario — no se agregó ninguno ahora tampoco. El payload que arma `saveChanges` sale de ese
mismo formulario, así que nunca puede incluir `slug`: cambiar `fecha_inicio`, `localidad`,
`visible_en_home`, `fecha_cierre_inscripcion` u otros campos editables **no toca el slug**. El link
público ya compartido (`/formulario/<slug>`) sigue funcionando igual después de cualquier edición.

### Compatibilidad con eventos existentes

Los eventos creados antes de esta revisión conservan su slug viejo (`lugar-fecha`, sin tipo ni
correlativo) — **no se migran ni se recalculan**. El fetch por slug no le pide ninguna forma
particular al string, así que ambos formatos conviven sin problema. La única acción manual
pendiente es la de `docs/supabase.md`: detectar y resolver los duplicados históricos antes de poder
aplicar el `UNIQUE`.

## Eliminación de eventos

Agregado en esta revisión (antes no existía ninguna función para borrar un evento desde el admin).
Botón "Eliminar" en `EventsList.jsx`, junto a "Modificar":

1. **Evento sin inscripciones asociadas** → se puede eliminar. Se borran primero sus filas de
   `event_games` y después la fila de `events`.
2. **Evento con una o más inscripciones asociadas** → **no se puede eliminar**. Se muestra el
   mensaje "No se puede eliminar este evento porque tiene inscripciones asociadas." y no se ejecuta
   ningún `DELETE`.

La comprobación (`inscriptions` con `id_evento = <id del evento>`, `limit(1)`) se hace **en el
momento real del borrado**, dentro de `handleDeleteEvent`, no solo para decidir si mostrar el botón
habilitado. La tabla además precarga qué eventos tienen inscripciones para mostrar la columna
"Inscriptos" y deshabilitar visualmente el botón en esos casos — es una ayuda de UX, no la
validación real; si esa foto quedó desactualizada (p. ej. alguien se inscribió justo después de
cargar la página), el chequeo en vivo dentro de `handleDeleteEvent` igual bloquea el borrado.

**Estas dos consultas usan la misma relación (`inscriptions.id_evento`) pero no son la misma
consulta, y eso importa:** `handleDeleteEvent` filtra por un solo evento y pide como máximo 1 fila
(`.eq('id_evento', event.id).limit(1)`) — no le afecta el volumen total de la tabla. La precarga de
la columna, en cambio, tiene que enumerar qué eventos de **toda la lista** tienen inscripciones, y
por eso sí es sensible a cuántas filas devuelve Supabase por request (ver el bug corregido más
abajo). Conclusión práctica: **el DELETE está protegido incluso si la columna "Inscriptos" muestra
un valor incorrecto** — la única forma de que el DELETE falle de la misma manera sería que RLS
oculte las filas de `inscriptions` a la sesión del admin, algo que no se puede confirmar desde el
código (ver `docs/supabase.md`).

### Bug corregido: la columna "Inscriptos" podía mostrar "No" en eventos que sí tenían inscripciones

La consulta original de la precarga (`select('id_evento').in('id_evento', eventIds)`, sin
`.limit()` ni paginación) no traía todas las filas si el total de inscripciones de los eventos
listados superaba el límite de filas por request de Supabase — el mismo límite que ya había
obligado a paginar por cursor en `InscriptionsList.jsx` (`BATCH = 1000`) y `EmailMasivo.jsx`. Con
suficiente volumen histórico acumulado, cualquier evento cuyas filas de `inscriptions` quedaran
fuera de la página devuelta aparecía como "No" sin serlo.

Corregido reusando el mismo patrón de paginación por cursor (ordenando por `id` de `inscriptions` y
avanzando con `.gt('id', cursor)` hasta agotar los resultados) para acumular el set completo de
`id_evento` con inscripciones, sin importar cuántas haya en total. No afecta a `handleDeleteEvent`
(ya era seguro, ver el punto anterior) ni cambia ningún comportamiento de eliminación — solo corrige
qué muestra la columna.

Se pide confirmación (`window.confirm`) antes de ejecutar el `DELETE`, después de haber verificado
que no hay inscripciones.

**Cualquier inscripción bloquea el borrado, sin mirar su estado** (`asistencia`, si tiene `qr_code`,
etc.) — no encontramos en el código ni en el esquema documentado ninguna razón para tratar una
inscripción como "descartable" (todas representan a alguien que se anotó), así que no se afinó esa
regla más allá de "existe al menos una fila".

## Reglas configurables por evento: edad y modo de selección de juegos

Agregado en esta revisión, pensado para torneos con requisitos particulares
(p. ej. un torneo exclusivo para menores de 18 con inscripción libre a
cualquier juego) sin acoplar la regla al evento puntual — todo se resuelve
leyendo columnas de `events`, así que cualquier evento presente o futuro puede
activarlas o no. Ver el detalle completo (validación, triggers, mensajes de
error) en `docs/inscripciones.md`, sección "Reglas configurables por evento".

Columnas nuevas en `events` (todas nullable o con default que preserva el
comportamiento histórico — ver `docs/supabase.md` para el detalle de tipos y
constraints):

- `edad_minima` (`integer`, nullable) — edad mínima inclusive para inscribirse.
  `NULL` = sin mínimo.
- `edad_maxima` (`integer`, nullable) — edad máxima inclusive. `NULL` = sin
  máximo. Ejemplo: `edad_maxima = 17` admite a alguien de 17 pero no a alguien
  de 18.
- `modo_seleccion_juegos` (`text`, `not null default 'clasificado'`, check
  `in ('clasificado', 'libre')`) — gobierna cómo se comporta el paso "Elegí tu
  juego" del wizard (`SeleccionJuego.jsx`):
  - `'clasificado'` (default histórico): comportamiento de siempre, sin
    cambios — un juego principal + hasta 1 secundario, o hasta 3 secundarios
    sin principal, según `games.principal`.
  - `'libre'`: se ignora `games.principal` por completo, todos los juegos del
    evento se muestran en un único conjunto y se puede elegir cualquier
    combinación.
- `max_juegos_por_participante` (`integer`, nullable, `>= 1` si no es `NULL`)
  — solo se evalúa bajo `modo_seleccion_juegos = 'libre'`. `NULL` = sin
  límite de cantidad. Bajo `'clasificado'` esta columna se ignora
  completamente (el tope sigue siendo el hardcodeado de siempre).

**No se tocó `games.principal` ni `event_games`.** La clasificación global de
juegos sigue existiendo tal cual estaba; el modo `'libre'` simplemente la
ignora para ese evento puntual.

**Edición con inscripciones existentes**: igual que `tipo`/`registration_mode`,
estos 4 campos quedan de solo lectura en `EditEventModal` en cuanto el evento
tiene al menos una inscripción, con el mismo criterio fail-closed ya usado en
el resto del admin (si no se puede confirmar que el evento no tiene
inscripciones, se bloquea la edición de estos campos igual). Ver
`docs/inscripciones.md` para el detalle del chequeo autoritativo al guardar.

## Quitar un juego de un evento (distinto de eliminar el evento entero)

**Regla:** un juego asociado a un evento no puede quitarse si existen inscripciones de ese juego
dentro de ese evento.

Esta es la contraparte, a nivel juego, de "Eliminación de eventos" de arriba — mismo espíritu
("no perder de vista una inscripción real"), pero aplicada al checkbox de cada juego dentro del
modal de edición (`EditEventModal`), no al evento completo. Antes de esta protección, un juego con
inscripciones no podía cambiar de modalidad, pero sí se lo podía destildar y sacar por completo del
evento — dejando esas inscripciones sin ningún `event_games` que las respalde dentro de ese evento.

El detalle completo (relación usada, bloqueo visual, chequeo autoritativo al guardar, comportamiento
ante fallos de verificación) está documentado en `docs/inscripciones.md`, sección "Restricción para
quitar un juego con inscripciones existentes del evento" — usa exactamente la misma relación
(`inscriptions.id_evento` + `games_inscriptions.id_game`) que ya se usaba para bloquear el cambio de
modalidad, sin agregar columnas ni tablas nuevas.

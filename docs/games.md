# Juegos (`games`)

No existía un documento dedicado a `games` — se mencionaba de paso en `docs/inscripciones.md`,
`docs/eventos.md` y `docs/supabase.md`, pero ninguno la trata como tema central. Este archivo es
nuevo y no reemplaza a ninguno de esos tres; para todo lo relacionado con `event_games`,
`registration_mode` y las reglas de edad/modo de selección de juegos por evento, la referencia
completa sigue siendo `docs/inscripciones.md` y `docs/eventos.md` — acá solo se repite lo mínimo
necesario para que este documento se entienda solo.

## Estado actual (confirmado por código)

### Estructura de `games` usada por el código

No hay ninguna migración versionada en el repo que cree la tabla `games` (mismo caso que
`events`/`inscriptions` — ver `docs/supabase.md`). Reconstruido desde las queries reales:

| Columna | Tipo asumido | Dónde se ve |
|---|---|---|
| `id` | `uuid` (inferido por consistencia de esquema — ver "Tipo real..." abajo; las comparaciones `g.id === game.id` que hay en todo el código no prueban numérico, `===` de JS compara igual dos strings) | todo el módulo |
| `game_name` | `text` | todo el módulo |
| `team_option` | `boolean` | `useGames`, `useEventGames`, `registrationMode.js`, `EventsList.jsx`, `AddTournamentForm.jsx` |
| `principal` | `boolean` | `useEventGames`, `SeleccionJuego.jsx` |
| `active` | `boolean` | `useGames` (único lugar que la lee) |

**Actualizado** (ver `docs/supabase.md`, sección "Tipo real de las columnas de ID"): un intento real
de aplicar `supabase/migrations/20260824_event_game_cupos.sql` contra Supabase falló con
`operator does not exist: uuid = bigint` — confirmó que `event_games.event_id` es `uuid`, no
`bigint` como se asumía acá antes. `games.id` no tiene una prueba tan directa (no hay ningún error
real que lo confirme puntualmente), pero se infiere `uuid` por consistencia de esquema — no hay
evidencia en contra en ningún lado de `src/` (cero usos de `parseInt`/`Number()`/aritmética sobre
`game.id` en todo el proyecto) y un esquema mixto `uuid`/`bigint` dentro del mismo proyecto sería
inusual sin motivo documentado.

**Sigue sin poder verificarse desde código/repositorio**: constraint `UNIQUE` sobre `game_name` más
allá del índice case-insensitive agregado en la etapa 1 (ver abajo), FKs formales
`event_games.game_id → games.id` y `games_inscriptions.id_game → games.id` (se documentan en
`docs/supabase.md` como asumidas por las queries, no como confirmadas contra la base real), RLS de
`games` fuera de lo que agrega `20260810_games_admin.sql` (SELECT público, INSERT/UPDATE admin — ver
abajo).

### No existe ningún código que escriba en `games`

Búsqueda exhaustiva de `.from('games').(update|insert|delete|upsert)` en todo `src/` y `api/`: **cero
resultados**. Hoy `game_name`, `team_option`, `principal` y `active` se administran **exclusivamente
a mano en el SQL Editor / Table Editor de Supabase** — no hay ningún formulario, botón ni endpoint
en este repo que toque esa tabla. Esto es la base de todo el análisis de riesgo de abajo: cualquier
cambio a esos campos hoy ya es posible (un admin de Supabase puede hacerlo directamente), la única
diferencia de la etapa futura es exponerlo desde el panel — el código que consume `games` ya tiene
que tolerar esos cambios ahora mismo.

### Todos los lugares que leen `games`

| Archivo | Qué trae | Filtra `active` | Para qué |
|---|---|---|---|
| `src/hooks/useGames.jsx` | `id, game_name, team_option` | **Sí** (`.eq('active', true)`) | Catálogo de juegos disponibles para asociar a un evento — usado por `AddTournamentForm.jsx` (alta) y `EventsList.jsx` (edición, `EditEventModal`) |
| `src/hooks/useEventGames.jsx` | `id, game_name, team_option, principal` (join `event_games → games`) + `registration_mode` de `event_games` | **No** | Juegos ya asociados a un evento puntual — alimenta `SeleccionInscripcion.jsx`/`SeleccionJuego.jsx` (flujo público) y la precarga de `EventsList.jsx` |
| `InscriptionsList.jsx` (línea ~149) | `select('*')`, tabla completa | **No** | Arma el `<select>` de filtro "por juego" en el listado admin de inscripciones — necesita ver juegos inactivos para poder filtrar inscripciones históricas |
| `InscriptionsList.jsx` (línea ~93) | `games_inscriptions(game:games(id, game_name))`, embed vía `inscriptions` | **No** | Muestra qué juego(s) tiene cada inscripción listada — de nuevo, sin filtro, para no ocultar histórico |
| `FilterSystem.jsx` | recibe `games` como prop (el de `InscriptionsList.jsx`) | heredado, no filtra | Checkboxes de filtro por juego |
| `emailService.js` (`nombresDeJuegos`) | no consulta `games` directamente — recibe objetos ya resueltos (`game_name`) desde quien lo llama | n/a | Arma el texto "Juego" del mail de confirmación (ver `docs/inscripciones.md`) |

**Conclusión sobre `active`**: hay exactamente **un** punto de filtrado (`useGames`). Todo lo demás
(`useEventGames`, los dos fetches de `InscriptionsList.jsx`) muestra juegos inactivos sin problema —
en la práctica esto es lo que hoy mantiene el historial intacto (ver más abajo, sección de riesgos
de `active`, incluyendo un bug concreto encontrado en `EventsList.jsx`).

## `active`: qué pasa hoy exactamente si se pone en `false`

- **Deja de ofrecerse para asociar a un evento nuevo o editado**: `useGames()` es la única fuente
  del checklist de juegos en `AddTournamentForm.jsx` y `EditEventModal` (`EventsList.jsx`) — un
  juego inactivo no aparece ahí, así que no se puede sumar a un evento nuevo ni volver a tildar en
  uno existente. Esto cumple el objetivo funcional pedido ("no debe ofrecerse para nuevas
  configuraciones").
- **Sigue apareciendo en el listado/filtro de inscripciones del admin** (`InscriptionsList.jsx`,
  `FilterSystem.jsx`) y en cada fila de inscripción que lo tenga asociado — correcto, cumple "no
  debe romper información histórica".
- **Sigue apareciendo en el flujo público de un evento que YA lo tiene asociado**:
  `SeleccionJuego.jsx` (paso "Elegí tu juego") recibe los juegos vía `useEventGames`, que **no
  filtra por `active`**. Si un evento con inscripciones abiertas tiene un juego inactivo entre sus
  `event_games`, ese juego **sigue ofreciéndose para nuevas inscripciones** en ese evento puntual —
  esto contradice el comportamiento deseado ("un juego inactivo no debe ofrecerse... donde
  corresponda") si la intención de "inactivo" incluye "ya no se puede elegir en ningún lado". Hoy
  el código **no** cumple eso: `active` solo bloquea el punto de entrada admin (asociar el juego a
  un evento), no el punto de entrada público (elegirlo dentro de un evento donde ya estaba
  asociado).
- **BUG CONCRETO encontrado**: en `EventsList.jsx` → `saveChanges` (línea ~628), al reinsertar
  `event_games` tras cualquier edición de un evento, el código busca los metadatos del juego así:

  ```js
  const game = games.find(g => g.id === gameId); // `games` = useGames(), SOLO activos
  registration_mode: game?.team_option ? (gameModes[gameId] ?? 'both') : 'individual',
  ```

  Si `gameId` corresponde a un juego que quedó **inactivo** pero seguía asociado al evento
  (`selectedGames` lo conserva porque su checkbox ni siquiera se renderiza — el `.map` de la lista
  de checkboxes también sale de `games`, la lista activa-only — así que nadie puede destildarlo,
  pero tampoco lo protege), `game` da `undefined`, y `game?.team_option` es `undefined` →
  **`registration_mode` se fuerza a `'individual'`** sin importar si ese juego venía como `'team'`
  o `'both'` y sin importar si ya tiene inscripciones reales bajo esa modalidad. Alcanza con que un
  admin edite **cualquier otro campo** del evento (fecha, localidad, lo que sea) y guarde, para que
  esto se dispare — no hace falta tocar el checklist de juegos a propósito. Esto puede pasar **hoy
  mismo**, sin ninguna interfaz nueva, si alguien pone `active = false` a mano en Supabase sobre un
  juego que ya está asociado a un evento activo. Es el hallazgo más importante de este relevamiento
  para la sección "Integridad histórica" — ver más abajo.

## `team_option`: dónde se usa y riesgo de editarlo

Dos roles distintos, ambos alrededor de `event_games`, nunca sobre inscripciones ya guardadas:

1. **Al asociar un juego a un evento** (`AddTournamentForm.jsx` alta, `EventsList.jsx` edición):
   controla si aparece el `<select>` de modalidad (Individual / Solo equipos / Individual o
   equipos). Si `team_option = false`, no se muestra selector y se fuerza
   `registration_mode = 'individual'` al guardar — sin depender de ningún estado de UI.
2. **Fallback de compatibilidad histórica** (`registrationMode.js` →
   `getEffectiveRegistrationMode`): cuando `event_games.registration_mode` es `NULL` (filas creadas
   antes de que existiera esa columna), la modalidad efectiva se calcula **en vivo, en cada
   render**, leyendo el `team_option` **actual** del juego: `team_option ? 'both' : 'individual'`.

### Impacto de cambiar `team_option` después de que el juego ya se usó

- **`event_games` con `registration_mode` YA seteado (no `NULL`)**: el cambio **no afecta** esas
  filas — `registration_mode` es una columna propia de `event_games`, no se recalcula a partir de
  `games.team_option` una vez guardada. Esto es seguro: los eventos que ya tienen la modalidad
  explícita quedan como están, mientras nadie vuelva a guardar cambios sobre ellos desde el admin
  (ver el punto siguiente).
- **`event_games` con `registration_mode = NULL` (histórico, sin migrar)**: el cambio de
  `team_option` **sí afecta, y en vivo**, la modalidad efectiva que ve el público — no es "solo
  futuro". Cualquiera que abra el paso "tipo de inscripción" de un evento con juegos en este estado
  va a ver el resultado del `team_option` actual, no el que tenía cuando se cargó el evento. No hay
  forma de saber desde el código cuántas filas de `event_games` siguen en este estado (depende de
  cuándo se creó cada evento) — **no verificable desde el repositorio**, requiere una consulta
  directa a Supabase.
- **Riesgo concreto al re-guardar un evento editado** (mismo patrón que el bug de `active` de
  arriba): `saveChanges` en `EventsList.jsx` recalcula `registration_mode` a partir de
  `game?.team_option` en el momento de guardar (líneas 558 y 633), no a partir de lo que ya estaba
  guardado. Si un juego pasa de `team_option = true` a `false` **después** de que un evento ya tiene
  inscripciones reales bajo modalidad `'team'`/`'both'`, y luego alguien edita y guarda ese evento
  desde el admin (por cualquier motivo, no necesariamente para tocar juegos), el juego se reinserta
  con `registration_mode: 'individual'` — pisando la modalidad real bajo la que se inscribió la
  gente. La protección existente (`gamesConInscripciones` + el freno de "no se puede modificar la
  modalidad de un juego con inscripciones") **compara el modo nuevo calculado contra el modo
  actual guardado en `localEventGames`** (línea ~558-561) — en teoría esto debería frenar el
  guardado si el modo calculado (`'individual'`, por `team_option` ahora `false`) difiere del modo
  real (`'team'`/`'both'`). Es decir: **el freno existente probablemente evita que este caso
  específico llegue a persistirse silenciosamente** (el `saveChanges` cortaría con el mensaje "No se
  puede modificar la modalidad de X porque ya tiene inscripciones asociadas") — pero esto depende de
  que el juego con inscripciones **siga apareciendo en `games` (activo)** para que `games.find(...)`
  no devuelva `undefined` en la línea 557; si el juego está además inactivo, cae en el mismo bug de
  `game?.team_option` siendo `undefined` (ternario cae a `'individual'`), coincide "casualmente" con
  lo que el freno espera comparar, y el chequeo de modalidad **no lo detecta** porque
  `modoNuevo !== modoActual` compara contra un `modoNuevo` ya corrompido, no contra el
  `team_option` real. No se pudo confirmar este último escenario contra una instancia real
  (combinación `active=false` + `team_option` cambiado + inscripciones existentes) — análisis
  estático del código, marcado como riesgo a probar antes de habilitar edición libre de
  `team_option` desde el admin.

**Conclusión**: no es seguro asumir que cambiar `team_option` de un juego con uso histórico "solo
afecta futuras inscripciones". Afecta también: (a) cualquier `event_games` con `registration_mode`
`NULL` en vivo, y (b) cualquier evento existente que se vuelva a guardar desde el admin, vía el
mismo patrón de bug que ya existe para `active`.

## `principal`: dónde se usa y cómo interactúa con `events`

`principal` es un atributo **global del juego** (vive en `games`, no en `event_games` — no hay
override por evento). Se consulta en un único lugar del flujo público: `SeleccionJuego.jsx`, y
únicamente cuando el evento está en modo `modo_seleccion_juegos = 'clasificado'` (el default
histórico, ver `docs/eventos.md`):

```js
const juegosPrincipales = games.filter(g => g.principal === true);
const juegosSecundariosDisponibles = games.filter(g => g.principal === false && ...);
```

En modo `'libre'` (columna de `events`, ver `docs/eventos.md`/`docs/inscripciones.md`),
`games.principal` **se ignora por completo** — todos los juegos del evento se muestran en un único
conjunto, sin distinción. Es decir, la restricción "un principal + N secundarios" no es una regla
fija de `principal`: es la interpretación que le da `SeleccionJuego.jsx` **solo** bajo
`'clasificado'`, tal como ya advertía el enunciado de esta tarea.

`principal` **no se muestra ni se edita en ningún formulario admin actual**
(`AddTournamentForm.jsx`, `EventsList.jsx` no lo leen ni lo escriben) — es, junto con `active`, un
campo puramente manual hoy.

### Riesgo de editar `principal`

- **No hay ninguna tabla que "recuerde" si un juego era principal o secundario en el momento de una
  inscripción pasada** — ni `inscriptions` ni `games_inscriptions` guardan esa clasificación, solo
  `id_game`. Cambiar `principal` **no corrompe ningún dato histórico ya guardado** (las filas de
  `inscriptions`/`games_inscriptions` no dependen de este valor para nada).
- **Pero sí cambia, en vivo, el comportamiento de cualquier evento en modo `'clasificado'` que
  todavía tenga inscripción abierta** y use ese juego: alguien que entre a inscribirse mañana va a
  ver ese juego en el bucket "principal" o "secundario" según el valor **actual**, sin importar qué
  bucket tenían quienes ya se inscribieron antes del cambio — dentro del mismo evento, con la
  inscripción todavía abierta, dos participantes podrían haber vivido una experiencia de selección
  distinta (uno vio el juego como principal, otro como secundario) sin que quede ningún registro de
  cuál vio cada uno.
- Es, en ese sentido, el más "seguro" de los tres campos para los datos duros (no rompe filas
  existentes), pero el más capaz de generar una experiencia de usuario inconsistente dentro de un
  mismo evento activo si se edita a mitad de una inscripción abierta.

## Tablas que relacionan `games` con eventos/inscripciones

- **`event_games`** (`id`, `event_id → events.id`, `game_id → games.id`, `registration_mode`,
  `cupo_maximo`): la asociación evento↔juego. Un juego "existe" para un evento puntual solo a
  través de esta tabla. `cupo_maximo` (agregada en `supabase/migrations/20260824_event_game_cupos.sql`)
  sigue el mismo criterio que `registration_mode`: es de la combinación evento+juego, no un
  atributo de `games` — el mismo juego puede tener 40 cupos en un evento y 25 en otro. Cuenta
  personas, no equipos. El detalle completo (semántica de `NULL`/`0`, cálculo de ocupados,
  protección ante concurrencia, inscripción atómica de equipos) vive en `docs/inscripciones.md`
  ("Cupos máximos por evento+juego" e "Inscripción atómica de equipos") y `docs/supabase.md` — no
  se repite acá, mismo criterio que ya usa este archivo para `registration_mode`.
- **`event_games_days`** (`id`, `event_game_id → event_games.id`, `date`): días específicos de un
  `event_games` en eventos de varios días — no depende de `games` directamente, solo de
  `event_games.id`.
- **`games_inscriptions`** (`id`, `id_inscription → inscriptions.id`, `id_game → games.id`): qué
  juego eligió cada inscripción concreta. Constraint real confirmada
  `unique (id_inscription, id_game)` (migración `20260804_event_participation_rules.sql`, ver
  `docs/inscripciones.md`) y trigger de límite de cantidad quienes correspondan al modo `'libre'`.

Ninguna de las dos tablas de relación **desnormaliza** `game_name`/`team_option`/`principal` —
siempre se resuelven por `JOIN` contra `games` en el momento de la consulta. Esto es justamente lo
que hace que editar esos tres campos tenga efecto retroactivo sobre cómo se **muestra** cualquier
fila histórica (el nombre del juego en un mail viejo, en el Excel exportado, en el listado de
inscripciones), aunque no sobre lo que ya se **guardó** (el `id_game` en sí no cambia).

## Imágenes actuales de juegos (100% hardcodeadas, distinto mecanismo al de la Galería)

A diferencia del carrusel (que usaba un array literal `{title, description, image}` importado
módulo por módulo — ver `docs/galeria.md`), acá el mecanismo es un **diccionario de configuración
por nombre exacto de juego**: `src/data/gameConfig.js`.

```js
export const GAME_CONFIG = {
    'LoL':               { slug: 'lol', color: '#C8AA6E', requiresVerify: true, verifyType: 'riot' },
    'League of Legends': { slug: 'lol', color: '#C8AA6E', requiresVerify: true, verifyType: 'riot' },
    'CS2':                { slug: 'cs2', color: '#DE9B35', requiresVerify: true, verifyType: 'steam' },
    // ... 7 juegos, con alias (varias claves distintas apuntando al mismo slug)
};

export const getGameConfig = (gameName) =>
    GAME_CONFIG[gameName] ?? { slug: gameName.toLowerCase().replace(/\s+/g, '-'), color: '#3b6cb4', requiresVerify: false, verifyType: null };
```

- **La relación NO es por `id` ni por un slug persistido en `games`** — es un lookup exacto de
  objeto JS por el string `game_name` (`GAME_CONFIG[gameName]`), **case-sensitive y sin normalizar
  espacios**. `'CS2'` y `'cs2'` son claves distintas.
- El `slug` resultante arma la ruta de imagen por convención:
  `/assets/img/games/{slug}-card.webp`, archivos servidos desde `public/assets/img/games/`
  (confirmado en disco: `cs2-card.webp`, `f1-card.webp`, `ff-card.webp`, `fifa-card.webp`,
  `cr-card.webp`, `lol-card.webp`, `valorant-card.webp`, más `steam-card.webp`/`riot-card.webp`,
  estos dos últimos fijos para las pantallas de verificación, no por juego). El comentario del
  propio archivo (`{slug}-banner.jpg`) está desactualizado — no existe ningún archivo `-banner` ni
  `.jpg`, todo es `-card.webp`.
- **Si `getGameConfig` no encuentra la clave exacta, cae a un fallback**: slug derivado
  automáticamente del nombre (probablemente sin imagen real → placeholder de color), `color`
  genérico, y — **el punto más importante** — `requiresVerify: false, verifyType: null`. Esto
  significa que **`gameConfig.js` no es solo un mapa de imágenes: gobierna si un juego pide
  verificación de Steam/Riot** (`VerificacionSteam.jsx`, `VerificacionRiot.jsx`,
  `SeleccionJuego.jsx`, `SeleccionInscripcion.jsx`, `Formulario.jsx`, `FormularioEquipo.jsx` — los 6
  archivos que llaman `getGameConfig` lo hacen mayormente para leer `verifyType`, no solo para la
  imagen).

### Todos los componentes que consumen esto

| Archivo | Para qué usa `getGameConfig` |
|---|---|
| `SeleccionJuego.jsx` | imagen de cada `GameCard` (`config.slug`), color de placeholder si la imagen falla (`onError`), y `verifyType` para decidir pasos siguientes |
| `SeleccionInscripcion.jsx` | precarga de imágenes (`new Image().src = ...`), y `verifyType` para calcular el siguiente paso del wizard |
| `Formulario.jsx` / `FormularioEquipo.jsx` | solo `verifyType` (deciden si el siguiente paso es Steam/Riot) — no consumen imagen acá |
| `VerificacionSteam.jsx` / `VerificacionRiot.jsx` | `verifyType` para saber si hace falta el otro paso también; la imagen de estas dos pantallas es fija (`steam-card.webp`/`riot-card.webp`, no depende del juego) |

**El admin (`AddTournamentForm.jsx`, `EventsList.jsx`) no usa `gameConfig.js` ni muestra ninguna
imagen de juego hoy** — el checklist de juegos es texto plano (`game.game_name`). Toda la lógica de
imagen/verificación vive exclusivamente del lado del flujo público.

### Qué habría que cambiar para dejar de depender de esto

No es un simple "mover a la base" — `gameConfig.js` mezcla dos responsabilidades (imagen y
verificación de identidad) que hoy conviven en el mismo lookup. Migrar solo la imagen a
`games.image_path` (lo que pide esta etapa) **no elimina la dependencia de `gameConfig.js`**: el
`verifyType`/`requiresVerify` seguiría viviendo ahí, con el mismo riesgo de desincronización por
nombre exacto. Ver "Riesgo de editar `game_name`" más abajo — es el hallazgo de mayor impacto de
todo este relevamiento.

## Riesgo de editar `game_name`

Es, con diferencia, **el campo más peligroso de editar libremente**, por la dependencia exacta y
case-sensitive con `gameConfig.js`:

1. **Romper la verificación de identidad silenciosamente**: si se renombra un juego que hoy
   requiere Steam/Riot (p. ej. "Counter-Strike 2" → "CS 2 Oficial") y el nuevo string no coincide
   con ninguna clave de `GAME_CONFIG`, `getGameConfig` cae al fallback
   `{ requiresVerify: false, verifyType: null }` — **el paso de verificación Steam/Riot deja de
   pedirse para ese juego, sin ningún error visible**, ni en el admin ni para el usuario público.
   Esto es silencioso y funcionalmente grave (afecta la integridad de la inscripción: alguien podría
   anotarse a un torneo de CS2 sin que se le pida su Steam ID).
2. **Romper la imagen**: el slug ya no matchea ningún archivo real de `public/assets/img/games/` →
   cae al fallback de `onError` (placeholder de color) — esto es solo cosmético, ya está resuelto
   con gracia por el código actual (`SeleccionJuego.jsx` ya maneja `imgError`).
3. **No rompe datos históricos**: `game_name` se resuelve siempre por `JOIN` en el momento de leer
   (ver sección anterior), así que un mail viejo, una fila de Excel exportado o el listado de
   inscripciones van a mostrar el nombre **actual**, no uno "congelado" — no hay inconsistencia de
   datos, pero si el nombre cambia, el histórico "cambia de etiqueta" retroactivamente (un
   participante que se inscribió a "CS2" vería, en un reporte futuro, que su inscripción dice "CS 2
   Oficial" si se renombró después).
4. **Riesgo de duplicados**: no hay ningún `UNIQUE` confirmado sobre `game_name` (ver "no
   verificable" arriba) — nada en el código impide crear dos juegos con el mismo nombre o con
   variantes casi idénticas ("CS2" y "Cs2"), lo que además duplicaría el problema del punto 1 (cuál
   de los dos matchea la clave de `GAME_CONFIG`, si alguno).

**Conclusión**: `game_name` no debería poder editarse libremente sin, como mínimo, una advertencia
explícita de que puede romper la verificación de identidad, y sin verificar contra
`GAME_CONFIG` que el nuevo nombre siga teniendo una entrada válida (o migrar `verifyType` a la base
también, lo cual está fuera del alcance de esta etapa).

**Actualización etapa 1**: el punto 4 (duplicados) quedó mitigado por el índice UNIQUE
case-insensitive agregado en esta etapa (ver más abajo) — sigue sin poder editarse `game_name` una
vez creado el juego, pero ya no se pueden dar de alta dos juegos con el mismo nombre (ni variantes
de mayúsculas/espacios) desde el panel.

## Implementado en etapa 1 (alta administrativa + imagen en el panel admin)

Esta etapa dejó crear juegos nuevos y cargar/reemplazar su imagen desde un panel nuevo (`Juegos`)
en el dashboard admin, sin tocar todavía el flujo público (eso se hizo después, ver "Implementado
etapa 2" más abajo). `gameConfig.js`, `VerificacionSteam.jsx`/`VerificacionRiot.jsx`,
`Formulario.jsx`/`FormularioEquipo.jsx`, `useGames.jsx` y todo `event_games`/
`games_inscriptions`/reglas de inscripción quedaron exactamente igual que antes en esta etapa 1 (y
siguen igual también después de la etapa 2 — ver el detalle de qué cambió realmente más abajo).

### `games.image_path`

Migración `supabase/migrations/20260810_games_admin.sql` (no aplicada desde este entorno — correrla
a mano, ver "Pasos manuales" más abajo). Agrega una única columna:

| Columna | Tipo | Notas |
|---|---|---|
| `image_path` | `text`, nullable | Path real del archivo en el bucket `juegos` (no la URL pública). `null` es el estado esperado para todo juego que no cargó imagen desde el panel — incluye **todos** los juegos existentes hasta que un admin les cargue una. |

Ninguna columna existente (`id`, `game_name`, `team_option`, `principal`, `active`) se modificó.

### Protección de `game_name` contra duplicados

**No existía ningún `UNIQUE` confirmado** (ver "Estado actual" arriba). La misma migración agrega
un **índice UNIQUE case-insensitive** sobre `lower(btrim(game_name))` (no sobre `game_name` tal
cual — así "CS2"/"cs2"/" CS2 " también quedan bloqueados entre sí, que es el riesgo real
documentado más arriba junto al lookup case-sensitive de `gameConfig.js`). Antes de crear el
índice, un bloque `do $$ ... $$` cuenta si ya existen nombres duplicados en los datos actuales
(mismo patrón que la Sección 4 de `20260804_event_participation_rules.sql` para
`games_inscriptions`): si encuentra alguno, aborta con `raise exception`
(`GAMES_DUPLICATE_NAME_ROWS_FOUND`, errcode `LCE07`) y **no aplica nada de la migración** — ni la
columna `image_path` ni el índice, porque todo corre en una única transacción. Si no hay
duplicados, el bloque no hace nada y el índice se crea normalmente.

En el frontend, `GamesList.jsx` valida el nombre en dos capas:
1. **Cliente**, contra el listado ya cargado (`useGamesAdmin`), case-insensitive y con `trim` —
   feedback inmediato, sin gastar un upload de imagen si el nombre ya existe.
2. **Base de datos** (autoritativa): si dos altas casi simultáneas desde sesiones admin distintas
   pasan el chequeo de cliente, el índice UNIQUE las va a diferenciar de todas formas — el
   `insert` que pierda la carrera recibe el `unique_violation` estándar de Postgres (`23505`),
   traducido a "Ya existe un juego con ese nombre." por `mapGamesRuleError`
   (`src/utils/gamesRules.js`, mismo patrón que `mapSupabaseRuleError` en `eventRules.js`).

### Storage: bucket `juegos`

El código llama `supabase.storage.from('juegos')` — bucket independiente, no reutiliza `galeria` ni
`eventos`. Se guarda `image_path` (ej. `1723315200000-fortnite.webp`), nunca la URL pública; se
deriva en runtime con `getPublicUrl`. Paths únicos vía `${Date.now()}-${nombreSaneado}`, mismo
saneo que ya usan `AddTournamentForm.jsx`/`EmailMasivo.jsx`/`GalleryList.jsx`. Sin `upsert: true` en
ningún upload — ni en la alta ni en el reemplazo, cada subida usa un path nuevo.

**El bucket `juegos` NO fue creado desde este repo.** Ver "Pasos manuales" más abajo.

### Alta de un juego

`GamesList.jsx` → `handleAdd`:
1. Valida `game_name` no vacío y no duplicado (ver arriba).
2. Si se seleccionó una imagen, la valida en JavaScript (MIME en
   `['image/jpeg', 'image/jpg', 'image/png', 'image/webp']`, tamaño `<= 5 MB`) — **la imagen es
   opcional al crear**: si no se selecciona ningún archivo, el juego se inserta con
   `image_path = null` y sigue dependiendo de `gameConfig.js` exactamente igual que los juegos
   existentes (se puede cargar la imagen después desde el mismo listado, con el mismo botón que usa
   el reemplazo).
3. Si hay imagen, la sube al bucket `juegos` con path único.
4. Inserta la fila en `games` con `game_name`, `team_option`, `principal` (los tres definidos en el
   formulario), `active: true` (siempre, sin control en la UI — ver más abajo) e `image_path` (el
   path recién subido, o `null`).
5. Si el `insert` falla después de haber subido una imagen, se intenta `storage.remove([path])`
   (best-effort, con log si también falla) antes de mostrar el error — evita dejar el archivo
   huérfano cuando se puede.

Campos del formulario de alta: **Nombre del juego** (texto libre), **Tipo** (`select` Individual/
Equipo → `team_option` boolean, default "Individual"), **Categoría** (`select` Secundario/Principal
→ `principal` boolean, default "Secundario") e **Imagen** (opcional). `active` **no aparece en el
formulario** — se inserta siempre en `true` desde el código, sin ningún control en la UI.

### Campos de solo lectura tras el alta

Para todos los juegos (nuevos y existentes), el listado de `GamesList.jsx` muestra `game_name`,
`team_option` (badge "Individual"/"Equipo") y `principal` (badge "Secundario"/"Principal") como
**texto/badge, no como input** — no hay ningún control para editarlos. `active` se muestra también
solo como badge informativo ("Activo"/"Inactivo") — **sin ningún botón para cambiarlo**, tal como
se pidió. Lo único editable en un juego ya creado es la imagen.

### Reemplazo (o carga inicial posterior) de imagen

Mismo botón para ambos casos ("Cargar imagen" si `image_path` es `null`, "Reemplazar imagen" si ya
tiene una) — internamente es el mismo flujo, `handleReplaceImage`, porque borrar un `image_path`
inexistente es un no-op seguro:

1. Se conserva el `image_path` anterior en memoria (viene del propio objeto `game` del listado).
2. Se valida el archivo nuevo (mismas reglas MIME/tamaño).
3. Se sube el archivo nuevo con un path **nuevo** — nunca se pisa el path viejo.
4. `update` de **solamente** `games.image_path` al path nuevo.
5. Si el `update` falla: se intenta borrar el archivo recién subido (best-effort) y se conserva la
   imagen anterior — el juego no cambia de estado.
6. Si el `update` funciona: se refleja en la UI de inmediato, y recién ahí se intenta borrar el
   archivo **anterior** (best-effort) — solo si existía.
7. Si falla el borrado del archivo anterior: **no se revierte el `image_path` ya actualizado** (el
   juego sigue mostrando la imagen nueva) — se loguea en consola y se informa en pantalla que puede
   haber quedado un archivo pendiente de limpieza manual en Storage.

### Validaciones de archivo

Mismas que Galería: JPG/JPEG, PNG, WebP, máximo 5 MB, validadas en JavaScript antes de cualquier
upload (`accept="image/jpeg,image/png,image/webp"` en el input es solo ayuda de UX, no la única
barrera). **Esta lógica quedó duplicada** (constantes `ACCEPTED_MIME_TYPES`/`MAX_FILE_SIZE_BYTES` +
`validateImageFile`/`sanitizeFileName`) entre `GalleryList.jsx` y `GamesList.jsx` — se evaluó
extraer un helper compartido (`src/utils/imageUploadValidation.js`) pero se decidió no hacerlo en
esta etapa para no tocar `GalleryList.jsx` (fuera de alcance del pedido) — queda anotado como deuda
técnica menor más abajo.

### Vista `Juegos` en el dashboard admin

`DashboardAdmin.jsx` suma un botón "Juegos" junto a "Galería"/"Listar Eventos"/etc., mismo patrón de
`view` state. Componente nuevo `src/components/pages/dashboardAdmin/games/GamesList.jsx`, reutiliza
las clases CSS compartidas de `InscriptionsList.css` (`.inscriptions-container`, `.titulos-admin`,
`.table-wrapper`, `.inscriptions-table`, `.export-button`, `.filter-group`/`.filter-label`/
`.filter-select`, `.email-masivo-file-input`/`.email-masivo-imagen-preview`,
`.success-message-admin`/`.error-message-admin`, `.gallery-add-panel`) más un puñado de clases
nuevas específicas (`.games-thumb`, `.games-thumb--empty`, `.games-badge` con modificadores
`--neutral`/`--active`/`--inactive`) agregadas al final del mismo archivo CSS compartido — sin
librerías nuevas, sin archivo `.css` nuevo. Columnas del listado: miniatura (o "Sin imagen" si
`image_path` es `null` — **no se usa `gameConfig.js` para mostrar la imagen hardcodeada como
fallback en el admin**, a propósito, para no acoplar este panel nuevo a esa lógica), nombre, tipo,
categoría, estado (solo informativo), y el botón de cargar/reemplazar imagen.

### `useGamesAdmin.jsx` — hook nuevo, `useGames.jsx` sin tocar

`useGames.jsx` sigue exactamente igual (`select("id, game_name, team_option").eq("active", true)`)
y lo siguen usando exactamente los mismos consumidores de antes
(`AddTournamentForm.jsx`/`EventsList.jsx`) sin ningún cambio de comportamiento. El listado de
`GamesList.jsx` usa un hook nuevo y separado, `src/hooks/useGamesAdmin.jsx`
(`select("id, game_name, team_option, principal, active, image_path")`, **sin** `.eq("active",
true)`, ordenado por `game_name`) — necesario porque el admin tiene que poder ver también los
juegos inactivos (aunque esta etapa no ofrezca ningún control para reactivarlos).

### Seguridad / RLS

La misma migración (`20260810_games_admin.sql`) habilita RLS en `games`: `SELECT` público
(`using (true)`), `INSERT`/`UPDATE` solo si `is_admin()` devuelve `true`, **sin policy de
`DELETE`** (a propósito — no se expone esa operación en esta etapa ni en ninguna futura planeada).
Los escrituras se hacen directo desde el frontend (`supabase.from('games')...`, cliente `anon key` +
sesión del admin logueado) — mismo patrón ya usado para `events`/`event_games` en `EventsList.jsx` y
para `gallery_items` en `GalleryList.jsx`, no a través de una API route con `service_role key`.

**Sobre `is_admin()`**: mismo aviso ya documentado para `gallery_items` — su existencia no está
versionada como migración en este repo. Antes de correr la Sección 3 de la migración, confirmar
`select proname from pg_proc where proname = 'is_admin';`.

**Storage**: `supabase/migrations/20260810_games_storage_policies.sql` (separada, porque requiere
que el bucket `juegos` ya exista): lectura pública de `bucket_id = 'juegos'`, `insert`/`delete` solo
admin. Se agregó también una policy de `update` sobre `storage.objects` aunque el flujo de esta
etapa nunca la use (siempre sube un path nuevo en vez de sobrescribir uno existente) — mismo
criterio de "cubrir la operación aunque el frontend hoy no la use" que ya se usó para
`trg_enforce_event_game_limit_update` en la migración de reglas de participación.

## Pasos manuales en Supabase (obligatorios, no aplicados desde este repo)

1. **Correr `supabase/migrations/20260810_games_admin.sql`** en el SQL Editor. Antes, confirmar
   `is_admin()`: `select proname from pg_proc where proname = 'is_admin';`. Si la Sección 2 aborta
   por `GAMES_DUPLICATE_NAME_ROWS_FOUND`, resolver los duplicados reales de `game_name` a mano
   (revisando primero si `event_games`/`games_inscriptions` referencian alguna de las filas
   duplicadas antes de decidir cuál conservar) y volver a correr el archivo completo.
2. **Crear el bucket `juegos`** en Dashboard de Supabase → Storage → "New bucket". Nombre EXACTO
   `juegos`, marcado como **público**.
3. **Correr `supabase/migrations/20260810_games_storage_policies.sql`**, después de crear el
   bucket.
4. **Probar el flujo completo con un admin real**: crear un juego con imagen, crear uno sin imagen,
   cargarle una imagen después, y reemplazar la imagen de un juego que ya tenía una — confirmar en
   el Storage del dashboard que el archivo anterior efectivamente desaparece tras un reemplazo
   exitoso.
5. **Probar el duplicado de nombre**: intentar crear un juego con un nombre ya existente (variando
   mayúsculas/espacios) y confirmar que se bloquea tanto por el mensaje de cliente como, si se
   fuerza una request directa saltando el frontend, por el índice UNIQUE
   (`mapGamesRuleError`/`23505`).
6. **Confirmar el tipo de PK real** de `games.id` (inferido como `uuid`, no confirmado con un error
   real como sí pasó con `event_games.event_id` — ver `docs/supabase.md`, "Tipo real de las columnas
   de ID"): `select column_name, data_type from information_schema.columns where
   table_name = 'games' and column_name = 'id';`.

## Implementado etapa 2 (uso público de `image_path`)

Esta etapa reemplaza la fuente de la imagen **general** de cada juego en las pantallas públicas: en
vez de `public/assets/img/games/{slug}-card.webp` (derivado de `gameConfig.js` por `game_name`), se
usa `games.image_path` (bucket `juegos`, cargado desde el panel admin en la etapa 1). Alcance
acotado a propósito: solo se tocó **dónde sale la imagen general**, nada de lo demás.

### Dónde se usaba la imagen hardcodeada y qué cambió

Búsqueda exhaustiva de `assets/img/games` en `src/` (4 usos de código, sin contar `docs/` ni el
comentario de `gameConfig.js`):

| Archivo | Antes | Ahora |
|---|---|---|
| `SeleccionJuego.jsx` (`GameCard`) | `<img src={`/assets/img/games/${config.slug}-card.webp`}>`, con `onError` cayendo a un placeholder coloreado por `config.color` | `<img src={getGameImageUrl(game.image_path)}>` si hay `image_path` (y no falló la carga); si no, placeholder gris neutro con texto "Sin imagen" — nunca se intenta la ruta hardcodeada |
| `SeleccionInscripcion.jsx` (precarga de imágenes) | `new Image().src = `/assets/img/games/${config.slug}-card.webp`` para cada juego del evento | `new Image().src = getGameImageUrl(game.image_path)`, y **se saltea por completo** si el juego no tiene `image_path` (no hay nada que precargar para un placeholder puramente CSS) |
| `VerificacionSteam.jsx` (banner fijo `steam-card.webp`) | sin cambios | **sin cambios** — no depende de ningún juego puntual, pedido explícito de no tocarlo |
| `VerificacionRiot.jsx` (banner fijo `riot-card.webp`) | sin cambios | **sin cambios** — ídem |

`Formulario.jsx`/`FormularioEquipo.jsx` nunca mostraron imagen de juego (solo `verifyType` vía
`getGameConfig`) — no había nada que cambiar ahí, y no se tocaron.

### Cómo se genera la URL pública

Helper nuevo `src/utils/gameImage.js` (`getGameImageUrl(imagePath)`):

```js
export const getGameImageUrl = (imagePath) => {
    if (!imagePath) return null;
    return supabase.storage.from('juegos').getPublicUrl(imagePath).data.publicUrl;
};
```

Mismo criterio que ya usan `GalleryList.jsx`/`GamesList.jsx` en el admin (path guardado, URL
derivada en runtime, nunca persistida) — separado en su propio archivo, no agregado a
`gameConfig.js`, para no mezclar la fuente de la imagen general (nueva, `image_path`) con la
configuración de verificación/slug que `gameConfig.js` sigue necesitando intacta.

### Queries que incorporaron `image_path`

Solo una: `src/hooks/useEventGames.jsx`, el JOIN `event_games → games` que ya traía `id, game_name,
team_option, principal` — se agregó `image_path` a esa misma lista de columnas del `select`
existente (sin agregar ningún `select`/request nuevo, sin N+1: sigue siendo una sola consulta por
lote de `event_games` de los eventos pedidos). El campo se propaga igual en el objeto que arma
`gamesByEvent`. Este hook alimenta tanto el flujo público (`SeleccionInscripcion.jsx` →
`SeleccionJuego.jsx`) como la precarga de `EventsList.jsx` en el admin — agregar una columna más no
le cambia nada a `EventsList.jsx` (solo lee `game_name`/`id`/`registration_mode` de esos objetos,
ignora el resto).

`useGames.jsx` (el catálogo activo-only para asociar juegos a un evento en
`AddTournamentForm.jsx`/`EventsList.jsx`) **no se tocó** — no muestra imágenes, no lo necesita.

### Placeholder cuando `image_path` es `null`/vacío

Implementado directamente en `GameCard` (`SeleccionJuego.jsx`) — es el único lugar del flujo
público que renderiza la imagen general de un juego, así que no se justificó un componente
compartido nuevo (helper pequeño evaluado y descartado por no tener un segundo consumidor real; ver
"Se mantiene deliberadamente" más abajo). Reutiliza el mismo contenedor `.sj-card-img` que ya
existía (mismo `aspect-ratio`, mismo tamaño de card, sin cambios de layout):

```jsx
{imageUrl && !imgError ? (
    <img src={imageUrl} alt={game.game_name} onError={() => setImgError(true)} />
) : (
    <div className="sj-card-placeholder">
        <span className="sj-card-placeholder-text">Sin imagen</span>
    </div>
)}
```

- **Nunca se llega a pedir** `/assets/img/games/...` ni ninguna URL rota — si `image_path` es
  `null`, directamente no se renderiza ningún `<img>`, evitando un request 404.
  Si `image_path` existe pero la URL de Storage falla al cargar (bucket mal configurado, archivo
  borrado manualmente, etc.), el mismo `onError` que ya existía cae al mismo placeholder neutro —
  cubre ambos casos con una sola rama.
- CSS (`src/styles/SeleccionJuego.css`, clase `.sj-card-placeholder` ya existente, reutilizada):
  antes tomaba su color de fondo por `style={{backgroundColor: config.color}}` (un color distinto
  por juego, leído de `gameConfig.js`); ahora tiene un fondo gris neutro fijo (`#e5e7eb`) igual para
  todos los juegos — a propósito, para que sea visualmente obvio y consistente qué juegos todavía no
  tienen imagen cargada, sin importar cuál sea. Se agregó `.sj-card-placeholder-text` para el texto
  "Sin imagen" centrado. Responsive gratis: hereda el mismo `aspect-ratio: 4/3` y `width:
  100%`/`height: 100%` que ya tenía el contenedor `.sj-card-img`, no se agregó ningún media query
  nuevo.
- El overlay con el nombre del juego (`.sj-card-overlay`/`.sj-card-name`, capa aparte sobre la
  imagen/placeholder) **no cambió** — sigue mostrando `game.game_name` igual que antes, con o sin
  imagen real debajo.

### Fallback eliminado

`GameCard` y la precarga de `SeleccionInscripcion.jsx` **ya no intentan `/assets/img/games/{slug}
-card.webp` bajo ninguna circunstancia** — ni como primer intento ni como fallback tras un error.
El único código que sigue leyendo `slug`/`color` de `gameConfig.js` es el que **no se tocó**: nada,
en rigor — `GameCard` ya no usa `config` en absoluto (se borró `const config =
getGameConfig(game.game_name)` de ese componente, era la única referencia a `gameConfig.js` ahí).
El import de `getGameConfig` en `SeleccionInscripcion.jsx` se conserva porque esa misma pantalla lo
sigue usando para `verifyType` (decidir el siguiente paso del wizard) — no relacionado con
imágenes.

### Se mantiene deliberadamente (etapa 2)

- **`gameConfig.js`** sigue siendo la fuente de `verifyType`/`requiresVerify` (Steam/Riot) para
  todo el wizard de inscripción — no se tocó su lógica ni su forma, solo se dejó de usar `slug`/
  `color` para la imagen general de cada `GameCard`. El lookup case-sensitive por `game_name` y
  todos los riesgos ya documentados arriba ("Riesgo de editar `game_name`") siguen vigentes tal
  cual.
- **`steam-card.webp`/`riot-card.webp`** (banners fijos de `VerificacionSteam.jsx`/
  `VerificacionRiot.jsx`) — sin cambios, no dependen de ningún juego puntual.
- **Archivos físicos legacy en `public/assets/img/games/`** (`cs2-card.webp`, `lol-card.webp`,
  `valorant-card.webp`, `fifa-card.webp`, `ff-card.webp`, `cr-card.webp`, `f1-card.webp`) — **no se
  borraron**, aunque después de esta etapa ya no los referencia ningún componente de imagen general
  (`GameCard` dejó de usar `config.slug` para armar esa ruta). Se conservan a propósito hasta
  confirmar en producción que ninguna otra funcionalidad depende de ellos, tal como se pidió. Los
  únicos dos archivos de esa misma carpeta que siguen en uso activo son `steam-card.webp` y
  `riot-card.webp` (los banners fijos de arriba, sin relación con `image_path`).

## Pendiente etapa 3 / futuro (no forma parte del alcance de esta feature todavía)

- Ninguna pendiente funcional concreta quedó abierta para la imagen general — con las etapas 1 y 2,
  el ciclo completo (alta con imagen → Storage → panel admin → pantallas públicas) ya está
  conectado de punta a punta.
- Sigue sin resolverse (deliberadamente, ver más abajo) la dependencia de `gameConfig.js` para
  `verifyType`/`requiresVerify`, y la imposibilidad de editar `game_name`/`team_option`/
  `principal`/`active` desde el admin después del alta.

## Deudas técnicas fuera de alcance (documentadas, no resueltas)

- **Dependencia de `gameConfig.js` respecto de `game_name`** (lookup exacto, case-sensitive, mezcla
  imagen + `verifyType`/`requiresVerify`) — sigue intacta. Un juego nuevo creado desde este panel
  que necesite verificación Steam/Riot **todavía requiere un deploy** (agregar la entrada a
  `GAME_CONFIG` a mano) — el alta desde el admin no es 100% autosuficiente para juegos que necesiten
  verificación de identidad.
- **Posibilidad futura de renombrar un juego**: no implementada a propósito (`game_name` queda de
  solo lectura tras el alta). Si algún día se habilita, hay que resolver antes el riesgo de romper
  la verificación de identidad en silencio (ver "Riesgo de editar `game_name`" arriba).
- **Bug de `EventsList.jsx` con juegos inactivos** (`game?.team_option` sobre `undefined` cuando
  `useGames()` no encuentra el juego por estar inactivo, pisando `registration_mode` a
  `'individual'` en el próximo guardado de un evento) — **sigue sin corregir, a propósito**: esta
  etapa no agrega ningún control para desactivar juegos (`active` se inserta en `true` siempre y
  queda de solo lectura), así que no genera juegos inactivos nuevos ni empeora la frecuencia con la
  que ese bug puede dispararse. Sigue siendo un riesgo latente si alguien desactiva un juego a mano
  en Supabase — documentado acá y en el código de `EventsList.jsx` no se tocó.
- **Edición futura de `team_option`/`principal`** en juegos existentes — no implementada. Si se
  necesita en el futuro, revisar primero el riesgo documentado arriba (afecta en vivo
  `event_games.registration_mode = NULL` histórico, y comparte el mismo patrón de bug que `active`
  en `EventsList.jsx`).
- **Validación de imagen duplicada entre `GalleryList.jsx` y `GamesList.jsx`** — se evaluó extraer
  un helper compartido, se decidió no hacerlo para no tocar Galería (fuera de alcance). Candidato a
  una futura limpieza si se agrega una tercera sección con upload de imágenes.

## Errores y casos borde conocidos (etapa 1)

- **Duplicado de nombre entre dos altas casi simultáneas**: el chequeo de cliente (contra el
  listado ya cargado) no es atómico — si dos sesiones admin distintas crean el mismo nombre casi al
  mismo tiempo, ambas pueden pasar el chequeo de cliente; el índice UNIQUE de la base es quien
  decide en última instancia, y la segunda request pierde con un `23505` traducido por
  `mapGamesRuleError`. No hay reintento automático (a diferencia del correlativo de slugs de
  eventos) — el admin simplemente ve el error y puede reintentar con otro nombre.
- **Reemplazo de imagen interrumpido a mitad de camino** (falla de red entre el `update` exitoso y
  el borrado de la imagen vieja): el juego queda usando la imagen nueva (correcto), pero la imagen
  vieja puede quedar huérfana en Storage — se informa en pantalla y se loguea, no hay limpieza
  automática posterior.
- **Migración abortada por duplicados reales de `game_name`** (`GAMES_DUPLICATE_NAME_ROWS_FOUND`):
  no se puede aplicar ni la columna `image_path` ni el índice hasta resolver los duplicados a mano
  — ver "Pasos manuales", punto 1.
- **`is_admin()` no versionada en este repo**: si no existe en la base real, ambas migraciones
  fallan al crear sus policies (mismo aviso ya documentado para `gallery_items`).
- **Bucket con nombre distinto a `juegos`**: rompe upload/reemplazo/lectura sin ningún error de SQL
  de por medio.
- **RLS de `games`/`storage.objects` (bucket `juegos`) no confirmable como aplicada** hasta que un
  admin real lo pruebe contra la instancia — ver "Pasos manuales".

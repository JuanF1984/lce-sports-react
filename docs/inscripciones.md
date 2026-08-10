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

## Reglas configurables por evento (edad y modo de selección de juegos)

Agregado en esta revisión. Cuatro columnas nuevas en `events` —
`edad_minima`, `edad_maxima`, `modo_seleccion_juegos`, `max_juegos_por_participante`
— permiten configurar, **por evento**, un límite de edad y/o un modo de
selección de juegos sin distinción principal/secundario. Ver
`docs/eventos.md` para el significado de cada columna y `docs/supabase.md`
para la migración, los triggers y los constraints exactos.

Principio general: **el frontend valida para la experiencia de usuario, la
base de datos (triggers) es la validación definitiva.** Cualquier cosa que el
frontend deje pasar (bug, evento cargado a medias, request directa a
Supabase) el trigger la rechaza igual.

### Límite de edad

**No existe `fecha_nacimiento` en ningún lado del esquema** (decisión
explícita para esta entrega). La edad sigue siendo el mismo campo de texto
auto-declarado de siempre (`edad`, validado como "solo dígitos" por
`validateAge`), sin verificación de identidad ni comparación contra la fecha
del evento. La validación de límite de edad se hace sobre ese mismo valor
auto-declarado — mismo nivel de confianza que el resto del formulario.
Consecuencia práctica: alguien que se inscribe siendo menor de la edad límite
pero que cumple años antes de la fecha del evento no queda detectado por
este mecanismo (no hay forma de saberlo sin fecha de nacimiento).

`edad_maxima` y `edad_minima` son **inclusive**: con `edad_maxima = 17`, una
persona de 17 años puede inscribirse y una de 18 no.

**Dónde se persiste cada participante** (verificado en el código antes de
implementar, no asumido):

| Participante | Dónde se inserta | Archivo |
|---|---|---|
| Inscripción individual | 1 fila en `inscriptions` | `Confirmacion.jsx` |
| Capitán de equipo | 1 fila en `inscriptions` | `ConfirmacionEquipo.jsx`, paso 1 |
| Cada jugador del equipo | 1 fila en `inscriptions` por jugador, insertadas secuencialmente | `ConfirmacionEquipo.jsx`, paso 2 |

Los tres casos son, en el fondo, un INSERT individual sobre `inscriptions`
por participante — por eso un único trigger `BEFORE INSERT FOR EACH ROW`
sobre esa tabla alcanza para cubrir individual, capitán **y** cada jugador
del equipo. **El límite de edad aplica a todos los integrantes, incluido el
capitán** — no solo al capitán.

**Frontend** (experiencia de usuario, no definitivo):
- Helper compartido `validateParticipantAge(edad, evento)` en
  `src/utils/eventRules.js` — si el evento no tiene `edad_minima` ni
  `edad_maxima`, siempre devuelve válido (no cambia nada para eventos sin
  estas reglas). Se usa en:
  - `Formulario.jsx` (inscripción individual).
  - `useFormularioEquipo.jsx` → `validateForm(eventoSeleccionado)` (capitán y
    cada jugador del array `jugadores`; `FormularioEquipo.jsx` ahora le pasa
    el evento seleccionado a `validateForm`).
- Mensaje específico vía `participantAgeErrorMessage(code, evento)`, p. ej.
  para `edad_maxima = 17`: *"Este torneo admite participantes de hasta 17
  años inclusive."*

**Backend/Supabase (definitivo)**: función `validate_participant_age()` +
trigger `trg_validate_participant_age` (`BEFORE INSERT ON inscriptions FOR
EACH ROW`), en
`supabase/migrations/20260804_event_participation_rules.sql`. Si el evento no
tiene límites configurados, no hace nada (evento sin cambios de
comportamiento). Si los tiene:
1. Requiere que `edad` esté presente (si no, `INVALID_PARTICIPANT_AGE`).
2. Intenta convertirla a entero de forma controlada (bloque
   `BEGIN/EXCEPTION`, no deja que un cast inválido tire un error genérico de
   Postgres) — si falla, `INVALID_PARTICIPANT_AGE`.
3. Rechaza negativos (`INVALID_PARTICIPANT_AGE`).
4. Si hay `edad_minima` y no se cumple: `EVENT_MINIMUM_AGE_NOT_MET`.
5. Si hay `edad_maxima` y se supera: `EVENT_MAXIMUM_AGE_EXCEEDED`.

Estos tres marcadores viajan como el mensaje de la excepción (y como
`errcode` custom `LCE01`/`LCE02`/`LCE03`), y el frontend los traduce a
mensajes de usuario en `Confirmacion.jsx`/`ConfirmacionEquipo.jsx` (ver más
abajo) — nunca se muestra el error crudo de SQL.

**Supuesto pendiente de verificar contra Supabase real** (sin acceso directo
a la instancia desde este entorno, ver `docs/supabase.md`): el trigger asume
que `inscriptions.edad` es una columna de texto (así la manda siempre el
frontend, sin parsear) y hace un cast defensivo — funciona igual si en
realidad ya fuera `integer`, pero no se pudo confirmar el tipo real de la
columna.

### Selección libre de juegos (`modo_seleccion_juegos = 'libre'`)

En `'clasificado'` (default histórico) **no cambia absolutamente nada**:
`SeleccionJuego.jsx` sigue exactamente igual, con el mismo hardcode de
siempre (1 principal + 1 secundario, o hasta 3 secundarios sin principal,
según `games.principal`). Esas reglas **siguen siendo exclusivamente de
frontend** — a propósito no se replicaron en la base en esta revisión (no era
parte del pedido, y el modo `'clasificado'` ya viene funcionando así desde
antes).

En `'libre'`:
- `SeleccionJuego.jsx` muestra **todos** los juegos del evento en un único
  conjunto (mismo componente `GameCard`, sin sub-pasos "principal"/
  "secundario"), ignorando `games.principal` por completo.
- Se puede seleccionar cualquier combinación, sin orden de prioridad.
- Cantidad permitida: `max_juegos_por_participante` si no es `NULL`; sin
  límite si es `NULL`.
- No se puede continuar sin seleccionar al menos un juego (mismo
  comportamiento que el modo `'clasificado'`, que tampoco lo permite).
- El contrato `onNext(juegos)` (array de juegos elegidos) es el mismo de
  siempre, así que el resto del wizard (verificación Steam/Riot, formulario
  de datos) no necesitó cambios: ya usaba `.some()` sobre un array de N
  juegos.
- Las validaciones de modalidad individual/equipo (`event_games.registration_mode`,
  ver más arriba) no se tocan: el filtrado por modalidad ocurre **antes**, en
  `SeleccionInscripcion.jsx`, sobre la lista de juegos que se le pasa a
  `SeleccionJuego.jsx` — es ortogonal a este cambio.

**Backend/Supabase (definitivo)**: la regla de cantidad máxima se protege
donde se crean las relaciones con los juegos, no en el frontend. Función
`enforce_event_game_limit()`, reutilizada por **dos triggers de sentencia**
independientes: `trg_enforce_event_game_limit_insert` (`AFTER INSERT ON
games_inscriptions REFERENCING NEW TABLE AS inserted_games FOR EACH
STATEMENT`) y `trg_enforce_event_game_limit_update` (mismo `REFERENCING`/
`FOR EACH STATEMENT`, pero `AFTER UPDATE`).

**Por qué dos triggers y no uno combinado**: Postgres no permite un trigger
`AFTER INSERT OR UPDATE ... REFERENCING NEW TABLE` — cuando un trigger lista
más de un evento, no puede pedir tabla de transición, hay que declarar un
trigger separado por cada evento que la necesite. La función no necesita
saber cuál de los dos la disparó (no lee `TG_OP`): en ambos casos opera
exclusivamente sobre `inserted_games`, la tabla de transición con las filas
nuevas de la sentencia.

Este diseño reemplaza uno anterior (`BEFORE INSERT FOR EACH ROW`) que
dependía de que un trigger de fila viera, vía `SELECT`, las filas hermanas ya
procesadas de un mismo `INSERT` multi-fila — nunca verificado contra una
instancia real y frágil por depender de un detalle interno de ejecución fila
por fila. El trigger de sentencia con tabla de transición evalúa en cambio el
**resultado final** de toda la sentencia, sin importar cuántas filas insertó
ni a cuántas inscripciones tocó:

1. Identifica todas las inscripciones afectadas por la sentencia
   (`select distinct id_inscription from inserted_games`, la tabla de
   transición con las filas nuevas del `INSERT`/`UPDATE`).
2. Bloquea esas inscripciones una por una, en orden ascendente por `id`
   (`select ... for update`), antes de contar nada.
3. Cuenta el total definitivo de `games_inscriptions` por cada inscripción
   afectada, cruzando con `events` para aplicar el filtro solo cuando
   `modo_seleccion_juegos = 'libre'` **y** `max_juegos_por_participante is
   not null` — en cualquier otro caso (`'clasificado'`, o `'libre'` sin
   máximo) esa inscripción queda afuera del cálculo por el propio
   `JOIN`/`WHERE`, nunca puede hacer fallar la sentencia.
4. Si alguna inscripción tocada por la sentencia quedó con más juegos que su
   máximo, rechaza con `EVENT_GAME_LIMIT_EXCEEDED` — Postgres revierte la
   sentencia **completa** (estándar de un trigger `AFTER STATEMENT`), así que
   no quedan filas parciales de ningún participante ni de ninguna
   inscripción del lote, aunque solo una de varias haya excedido el máximo.

**Multi-fila**: la inscripción individual inserta todos sus juegos en un
solo INSERT con múltiples filas (`Confirmacion.jsx`, un solo
`.insert(gameRows)`). Como el trigger corre una sola vez después de toda la
sentencia (no fila por fila), esto ya no depende de ningún supuesto sobre
visibilidad de filas hermanas dentro del mismo comando — el conteo siempre
ve el resultado final real. La inscripción de equipo inserta un juego a la
vez por participante (el flujo de equipo solo admite un juego por
inscripción); el mismo trigger cubre igual ese caso, porque también dispara
en sentencias de una sola fila.

**Condición de carrera**: el trigger bloquea (`select ... for update`) todas
las inscripciones afectadas, en orden determinístico, antes de contar —
serializa sentencias concurrentes que tocan la misma inscripción (la segunda
queda esperando el lock hasta que la primera haga commit o rollback, y recién
ahí cuenta el total real combinado de ambas) y el orden ascendente evita
deadlocks entre dos sentencias que bloqueen el mismo conjunto de
inscripciones en órdenes distintos. **Esto todavía no se probó contra una
instancia real** — el diseño requiere confirmarse con dos sesiones SQL
simultáneas, no alcanza con el análisis estático del trigger; el guion
exacto para hacerlo está en
`supabase/tests/20260804_event_participation_rules_manual_tests.sql`, sección
"Concurrencia".

**UPDATE**: `trg_enforce_event_game_limit_update` cubre un `UPDATE` que
reasigne `id_inscription` o `id_game` de una fila existente de
`games_inscriptions` — la inscripción de destino (adonde queda la relación
tras el cambio) es la que aparece en `inserted_games`, así que entra en el
cálculo igual que cualquier inscripción tocada por un INSERT, sin lógica
aparte. Hoy el código de la app nunca hace `UPDATE` sobre esa tabla (solo
`INSERT`, ver `Confirmacion.jsx` / `ConfirmacionEquipo.jsx`) — se cubre de
todas formas para que la protección sea real contra cualquier request
directa, no solo contra el `INSERT` que usa
hoy el frontend.

**Duplicados de juego por inscripción**: restricción real
`games_inscriptions_inscription_game_key unique (id_inscription, id_game)`,
aplicada por la migración. A diferencia de una versión anterior (que dejaba
esto comentado, sin aplicar), la migración ahora comprueba ella misma si
existen duplicados antes de crear la restricción (bloque `do $$ ... $$` con
`raise exception` si encuentra alguno, marcador
`GAMES_INSCRIPTIONS_DUPLICATE_ROWS_FOUND`) — no borra ni fusiona filas
automáticamente, y como toda la migración corre en una única transacción, un
aborto por duplicados revierte también el resto del archivo (columnas,
trigger de edad, trigger de límite de juegos). Si el frontend intentara
insertar el mismo `(id_inscription, id_game)` dos veces (no debería poder
pasar en el flujo normal — `SeleccionJuego.jsx` arma la selección con
`.some()`/`.findIndex()`, que evita elegir el mismo juego dos veces), la
violación de esta restricción (`errcode` estándar de Postgres `23505`) se
traduce a un mensaje genérico vía `mapSupabaseRuleError` en
`src/utils/eventRules.js`, igual que los demás marcadores — nunca se expone
el error crudo de SQL.

### Mensajes de error específicos en la pantalla de confirmación

`Confirmacion.jsx` y `ConfirmacionEquipo.jsx` usan
`mapSupabaseRuleError(err)` (`src/utils/eventRules.js`) para traducir los
marcadores del trigger a mensajes de usuario:

| Marcador | Mensaje mostrado |
|---|---|
| `INVALID_PARTICIPANT_AGE` | "La edad ingresada no es válida para este evento." |
| `EVENT_MINIMUM_AGE_NOT_MET` | "No se cumple la edad mínima requerida para este evento." |
| `EVENT_MAXIMUM_AGE_EXCEEDED` | "Se superó la edad máxima permitida para este evento." |
| `EVENT_GAME_LIMIT_EXCEEDED` | "Se superó la cantidad máxima de juegos permitida por participante en este evento." |

Además de estos cuatro marcadores custom, `mapSupabaseRuleError` también
reconoce la violación de la restricción `UNIQUE`
`games_inscriptions_inscription_game_key` (`errcode` estándar de Postgres
`23505`, no un marcador propio) y la traduce a "Ese juego ya estaba
registrado para esta inscripción.".

Si el error no coincide con ninguno de estos casos, se mantiene el mensaje
genérico de siempre ("Hubo un error al guardar tu inscripción..."). En
ningún caso se expone el mensaje crudo de Postgres/SQL al usuario final.

### Bloqueo de edición con inscripciones existentes

`edad_minima`, `edad_maxima`, `modo_seleccion_juegos` y
`max_juegos_por_participante` quedan de solo lectura en `EditEventModal` en
cuanto el evento tiene al menos una inscripción — mismo criterio que ya
existía para `tipo` (inmutable siempre) y `registration_mode`/quitar juegos
(bloqueados con inscripciones). Doble chequeo, igual que el resto del
archivo:
- **Al abrir el modal**: se usa el flag `tieneInscripciones[event.id]` que
  `EventsList.jsx` ya precarga para toda la lista (columna "Inscriptos"),
  deshabilitando los 4 campos.
- **Al guardar** (`saveChanges`): chequeo autoritativo e independiente,
  `eventoTieneInscripciones(eventId)` (nueva consulta puntual, mismo patrón
  que la que ya usa `handleDeleteEvent`). Si el evento tiene inscripciones y
  alguno de los 4 campos cambió respecto al valor original, se frena **todo
  el guardado** (no se aplica ningún cambio parcial). Si esa verificación
  falla (red, RLS), se trata como si el evento **sí** tuviera inscripciones
  (fail-closed) y también se bloquea el guardado de esos campos.

## Consultas a Supabase por paso

| Paso | Tabla(s) | Operación |
|---|---|---|
| Carga inicial | `events` | `select('*').eq('slug', eventoSlug).single()` |
| Carga inicial | `event_games` (join `games`), `event_games_days` | `select` vía `useEventGames` (incluye `registration_mode`) |
| `Formulario` / `FormularioEquipo` / `VerificacionSteam` / `VerificacionRiot` | `events` | **Re-fetch** por `id` vía `useEventoSeleccionado(eventoId)` (hook separado, duplica la consulta ya hecha en `SeleccionInscripcion`) |
| `Confirmacion` (individual) | `inscriptions`, `games_inscriptions` | `insert` + `update` (para `qr_code`) |
| `ConfirmacionEquipo` | `inscriptions` (una fila por capitán + una por jugador), `games_inscriptions` | `insert` + `update` por cada fila |
| `Confirmacion` / `ConfirmacionEquipo` | — | Envío de email best-effort vía `enviarConfirmacionIndividual` / `enviarConfirmacionEquipo` (`src/utils/emailService.js`) — **se omite si `eventoSeleccionado.tipo === 'presentacion'`** |

## Sección pública de "Preguntas Frecuentes" — eliminada

La Home (`Main.jsx`) tenía una sección `<FAQ />` entre `ProximoEvento` y `CarruselTextAndImage`,
con su propio componente (`src/components/layout/main/FAQ.jsx`), estilos
(`src/styles/FAQ.css`) y datos (`src/utils/faqData.js`). Se eliminó por completo en esta revisión:
el componente, el import y el render en `Main.jsx`, y los tres archivos (`FAQ.jsx`, `FAQ.css`,
`faqData.js`) — ninguno tenía otro consumidor en el código. No existía ningún link de navbar,
menú o footer apuntando a esta sección (`Header.jsx`/`NavBar.jsx`/`Footer.jsx` no tienen ningún
`#faq` ni referencia a preguntas frecuentes), así que no hubo que tocar navegación. El resto de la
Home (evento próximo, carrusel, redes sociales) no se modificó.

`src/utils/faqEmail.js` (`getFAQsHtmlForEmail`) también se eliminó — era exclusivamente el
adaptador que usaba `emailService.js` para insertar FAQs por juego dentro del correo de
confirmación (ver la sección siguiente); no tenía otro uso.

## Email de confirmación de inscripción

Contenido simplificado en una revisión anterior al mínimo indispensable — antes incluía además
FAQs específicas por juego (armadas con `faqData`/`faqEmail`, ver sección anterior), y (en equipos)
el nombre del equipo y el nombre del capitán en el correo de cada jugador.

**Corrección aplicada en esta revisión**: una revisión previa había hecho que la fila de juegos
mostrara **todos** los juegos configurados para el evento (`event_games`), en vez del juego al que
se inscribió esa persona/equipo puntual — interpretación incorrecta del pedido original. Se
revirtió: la fila ahora vuelve a mostrar únicamente el/los juego(s) de la inscripción.

El correo informa únicamente:

- **Fecha** del evento (`evento_fecha`) — fecha del **evento**, no del participante ni de los
  juegos que haya elegido. Se arma con `formatearFechaEventoParaMail(evento)`
  (`src/utils/emailService.js`): `fecha_inicio` formateado y, si el evento dura más de un día
  (`fecha_fin` presente y distinto de `fecha_inicio`), también `fecha_fin` — mismo criterio que ya
  usa `EventoModal.jsx` para mostrar el rango de fechas en la UI.
- **Hora** (`evento_hora` = `evento.hora_inicio`).
- **Lugar** (`evento_lugar` = `evento.localidad`).
- **Ubicación** (`evento_direccion` = `evento.direccion`, más un link a Google Maps si
  `evento.ubicacion_url` está cargado).
- **Juego** (`juegos_lista_texto`, fila con label "Juego" en `api/send-email.js`) — el/los juego(s)
  de **esa inscripción puntual**, no el resto de los juegos configurados para el evento. No se
  agregó ninguna consulta nueva a Supabase; en ambos flujos se reutiliza información que el wizard
  ya tenía calculada:
  - **Individual** (`Confirmacion.jsx`): se reutiliza directamente la prop `juegosSeleccionados`
    que ya recibía el componente — el mismo array que se usa para el `insert` en
    `games_inscriptions` (`guardarInscripcion`), así que el email siempre coincide exactamente con
    lo que se guardó (puede tener más de un juego: principal + secundario, o varios en modo
    `'libre'`). Se pasa como tercer parámetro a `enviarConfirmacionIndividual`.
  - **Equipo** (`ConfirmacionEquipo.jsx`): el flujo de equipo guarda un único juego por inscripción
    (`equipoFormData.selectedGame`, un `id`, no un objeto con `game_name`). El componente recibe
    además la prop `juegosSeleccionados` (los juegos ofrecidos en el paso "juego", con
    `id`/`game_name`) y arma `juegoInscripcion = juegosSeleccionados.filter(j => j.id ===
    selectedGame)` — el objeto completo del juego realmente guardado — antes de pasarlo como
    tercer parámetro a `enviarConfirmacionEquipo`. Ambas props (`equipoFormData` y
    `juegosSeleccionados`) ya existían/se calculaban en `SeleccionInscripcion.jsx`; no hizo falta
    ningún fetch adicional.
  - En `SeleccionInscripcion.jsx`, la prop `todosLosJuegosEvento={games}` que se pasaba a
    `Confirmacion.jsx`/`ConfirmacionEquipo.jsx` se eliminó (junto con el parámetro homónimo en
    `enviarConfirmacionIndividual`/`enviarConfirmacionEquipo`, renombrado a
    `juegosInscripcion`/`juegoInscripcion`) — ya no se usaba nada del array completo de juegos del
    evento para el email.

Se mantienen: un encabezado breve ("Confirmación de Inscripción"), el saludo con el nombre del
destinatario (`to_name` — es una personalización del saludo hacia esa misma persona, no un dato
que se le "informa" de otro participante) y una despedida simple. Se mantiene fuera del cuerpo: el
nombre del equipo, el nombre del capitán (aparecía en el correo de cada jugador del equipo), y el
bloque de FAQs por juego.

**Sin cambios**: qué dispara el envío (`Confirmacion.jsx` / `ConfirmacionEquipo.jsx`, best-effort,
se omite para `tipo = 'presentacion'`), el guardado de la inscripción, las validaciones, los
triggers/RLS, la estructura de tablas, la configuración de Resend, los destinatarios, ni el manejo
de errores de `enviarConResend` (`src/utils/emailService.js`) y del handler de
`api/send-email.js` (ambos conservan el mismo try/catch y los mismos mensajes de error que ya
tenían).

**Único ajuste de flujo de datos necesario**: en `ConfirmacionEquipo.jsx`, el objeto `evento` que se
arma a mano para pasarle a `enviarConfirmacionEquipo` no incluía `fecha_fin` ni `ubicacion_url`
(sí los incluía la versión individual en `Confirmacion.jsx`) — se agregaron ambos, tomados de
`eventoSeleccionado` (que ya los tenía, por venir de `select('*')`), para que el correo de equipo
también pueda mostrar el rango de fechas de eventos multi-día y el link de ubicación, igual que el
correo individual. No se agregó ninguna columna nueva ni una consulta nueva a Supabase.

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

### Cambios de esta cuarta revisión (reglas configurables por evento: edad y modo de selección de juegos)

- Se agregaron `events.edad_minima`, `events.edad_maxima`,
  `events.modo_seleccion_juegos` (`'clasificado'`/`'libre'`, default
  `'clasificado'`) y `events.max_juegos_por_participante` — ver la sección
  dedicada más arriba y `docs/eventos.md`/`docs/supabase.md`.
- Validación de edad de UI en `Formulario.jsx` y `useFormularioEquipo.jsx`
  (capitán y cada jugador) vía el helper compartido
  `validateParticipantAge`/`participantAgeErrorMessage`
  (`src/utils/eventRules.js`).
- Validación de edad **definitiva** vía trigger `BEFORE INSERT ON
  inscriptions` (`supabase/migrations/20260804_event_participation_rules.sql`).
- `SeleccionJuego.jsx` agregó una rama para `modo_seleccion_juegos = 'libre'`
  (todos los juegos en un único conjunto, sin principal/secundario, tope
  opcional). El modo `'clasificado'` no cambió ni un carácter de su
  comportamiento.
- Validación **definitiva** del máximo de juegos vía trigger de sentencia
  sobre `games_inscriptions`, activo solo bajo modo `'libre'` (rediseñado en
  la quinta revisión, ver más abajo — el diseño original de esta cuarta
  revisión era `BEFORE INSERT FOR EACH ROW` y quedó reemplazado).
- `Confirmacion.jsx`/`ConfirmacionEquipo.jsx` traducen los marcadores de
  error del trigger (`INVALID_PARTICIPANT_AGE`, `EVENT_MINIMUM_AGE_NOT_MET`,
  `EVENT_MAXIMUM_AGE_EXCEEDED`, `EVENT_GAME_LIMIT_EXCEEDED`) a mensajes
  específicos, con fallback al mensaje genérico de siempre.
- `EventsList.jsx`/`EditEventModal` agregaron los 4 campos nuevos, bloqueados
  a solo lectura cuando el evento ya tiene inscripciones (mismo criterio que
  `tipo`/`registration_mode`), con chequeo autoritativo fail-closed al
  guardar.
- **No se tocó** `games.principal`, `event_games`, ni las reglas de
  principal/secundario del modo `'clasificado'` (siguen siendo
  exclusivamente de frontend, a propósito). No se agregó `fecha_nacimiento`
  ni ninguna iniciativa de tipado TypeScript — quedó fuera de alcance a
  pedido explícito.
- No se implementaron condiciones basadas en el id/slug/nombre de ningún
  evento puntual: toda la lógica nueva lee exclusivamente las 4 columnas de
  configuración de `events`.

### Cambios de esta quinta revisión (integridad del límite de juegos + UNIQUE real)

Cierra dos puntos que habían quedado abiertos al final de la cuarta revisión,
antes de aplicar la migración por primera vez contra Supabase:

- **El trigger de máximo de juegos se rediseñó por completo**: de
  `BEFORE INSERT ON games_inscriptions FOR EACH ROW` (dependía de un supuesto
  no verificado sobre visibilidad de filas hermanas dentro de un mismo
  `INSERT` multi-fila) a un trigger de sentencia con tabla de transición
  (`REFERENCING NEW TABLE AS inserted_games FOR EACH STATEMENT`) que evalúa
  el resultado definitivo de toda la sentencia, sin ese supuesto. Ver el
  detalle completo en la sección "Selección libre de juegos" más arriba y en
  `docs/supabase.md`.
  - Postgres no permite combinar `INSERT`/`UPDATE` en un solo trigger cuando
    se pide tabla de transición, así que quedaron **dos triggers separados**
    que reutilizan la misma función `enforce_event_game_limit()`:
    `trg_enforce_event_game_limit_insert` (`AFTER INSERT`) y
    `trg_enforce_event_game_limit_update` (`AFTER UPDATE`). Un primer intento
    de esta revisión los había combinado en uno solo (`AFTER INSERT OR
    UPDATE ... REFERENCING NEW TABLE`), sintácticamente inválido en
    Postgres — corregido antes de aplicar la migración por primera vez.
  - `trg_enforce_event_game_limit_update` cubre `UPDATE` sobre
    `games_inscriptions`, no solo `INSERT` (aunque el frontend hoy solo hace
    `INSERT`), incluyendo el caso de mover una relación hacia una
    inscripción de destino que ya está en su máximo.
- **Se aplicó la restricción `UNIQUE (id_inscription, id_game)`
  (`games_inscriptions_inscription_game_key`)**, que en la cuarta revisión
  había quedado documentada pero comentada. La migración ahora comprueba ella
  misma si hay duplicados (bloque `do $$ ... $$`) y aborta con un mensaje
  explícito si encuentra alguno, en vez de depender de que una persona lea a
  mano el resultado de un `SELECT`.
- Toda la migración pasó a correr dentro de una única transacción explícita
  (`begin;` / `commit;`): un aborto por duplicados en la sección del `UNIQUE`
  revierte también las columnas nuevas de `events` y el trigger de edad — o
  se aplica el archivo completo, o no se aplica nada.
- **`ConfirmacionEquipo.jsx` corrigió un bug preexistente**: los `insert` en
  `games_inscriptions` para el capitán y para cada jugador no revisaban
  `error` (`await supabase.from("games_inscriptions").insert(...)` sin
  desestructurar ni chequear el resultado). Con los triggers/constraint
  nuevos, un rechazo del lado de Supabase en ese punto exacto habría quedado
  silenciado — la pantalla de confirmación hubiera mostrado éxito aunque el
  juego no se haya guardado, rompiendo el criterio fail-closed que ya regía
  el resto del flujo. Ahora ambos `insert` capturan `error` y lo relanzan
  (`if (error) throw error`), como ya hacía `Confirmacion.jsx`.
- `src/utils/eventRules.js` sumó el reconocimiento de la violación de la
  restricción `UNIQUE` (`errcode` `23505` de Postgres, no un marcador custom)
  en `mapSupabaseRuleError`, con un mensaje genérico ("Ese juego ya estaba
  registrado para esta inscripción.") — no debería poder dispararse en el
  flujo normal (`SeleccionJuego.jsx` ya impide elegir el mismo juego dos
  veces desde la UI), pero si aparece por cualquier motivo no se expone el
  error crudo de SQL.
- Pruebas SQL manuales reproducibles (edad, juegos multi-fila/multi-
  inscripción, y concurrencia con dos sesiones reales) en
  `supabase/tests/20260804_event_participation_rules_manual_tests.sql` —
  archivo nuevo, no es parte de la migración y no se ejecuta automáticamente.
- **No se tocó** ninguna decisión previa: la edad sigue siendo auto-declarada
  sin `fecha_nacimiento`, `edad_maxima` sigue inclusive, `modo_seleccion_juegos
  = 'clasificado'` conserva la lógica histórica sin cambios, `NULL` en
  `max_juegos_por_participante` sigue significando ilimitado, y el bloqueo de
  edición de estas reglas con inscripciones existentes sigue igual.

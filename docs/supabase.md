# Esquema de Supabase esperado por el código

Este proyecto no tiene acceso directo a la instancia de Supabase desde el entorno de desarrollo/CI.
Este documento describe lo que el **código actualmente asume** sobre el esquema de la base,
reconstruido a partir de las consultas (`supabase.from(...)`), de la migración encontrada en el
historial de git y del spec original de la feature de presentaciones
(`claude/commands/inscripcion-presentaciones.md`). Es responsabilidad de quien administra Supabase
confirmar que la base real coincide con esto.

## Tablas y columnas usadas por el código

### `events`

| Columna | Usada en | Notas |
|---|---|---|
| `id` | todo el módulo | PK |
| `created_at` | — | no se lee explícitamente pero se asume que existe |
| `fecha_inicio` | fecha (date, `YYYY-MM-DD`) | not null asumido |
| `fecha_fin` | fecha (date, `YYYY-MM-DD`) | puede ser null (eventos de un día) |
| `localidad` | texto | |
| `hora_inicio` | texto/time | puede ser null |
| `direccion` | texto | puede ser null |
| `ubicacion_url` | texto | puede ser null |
| `slug` | texto | usado como clave de búsqueda pública (`/formulario/:slug`) — **causa confirmada de un incidente en producción por no tener `UNIQUE`** (ver "Protección en Supabase" más abajo); la migración `20260730_events_slug_unique.sql` deja preparada la restricción, pendiente de que el administrador la aplique |
| `imagen_url` | texto | puede ser null |
| `inscripciones_abiertas` | boolean | default asumido `true`; `false` cierra el evento |
| `visible_en_home` | boolean, `not null default true` | agregada en `20260701_add_event_tipo.sql` |
| `tipo` | text, `not null default 'torneo'`, `check (tipo in ('torneo','presentacion'))` | agregada en la misma migración |
| `fecha_cierre_inscripcion` | `timestamptz`, nullable | agregada en la misma migración |
| `nombre` | text, nullable | **creada manualmente en Supabase** (no vino de una migración versionada en el repo) — ver "Columnas nuevas creadas manualmente" más abajo |
| `edad_minima` | integer, nullable, `check (edad_minima is null or edad_minima >= 0)` | agregada en `20260804_event_participation_rules.sql`. `NULL` = sin mínimo. |
| `edad_maxima` | integer, nullable, `check (edad_maxima is null or edad_maxima >= 0)` | agregada en la misma migración. `NULL` = sin máximo. Inclusive (ver `docs/inscripciones.md`). |
| `modo_seleccion_juegos` | text, `not null default 'clasificado'`, `check in ('clasificado','libre')` | agregada en la misma migración. Gobierna `SeleccionJuego.jsx` — ver `docs/eventos.md`. |
| `max_juegos_por_participante` | integer, nullable, `check (max_juegos_por_participante is null or max_juegos_por_participante >= 1)` | agregada en la misma migración. Solo se evalúa bajo `modo_seleccion_juegos = 'libre'`. |

Constraint adicional a nivel tabla: `edad_minima is null or edad_maxima is null or edad_minima <= edad_maxima`
(`events_edad_rango_valido`).

### `games`

`id, game_name, team_option, principal, active`. `useGames` sólo trae `active = true`. **Sin
cambios** en esta revisión — `team_option` sigue siendo el flag general del juego, la modalidad
efectiva por evento vive en `event_games.registration_mode` (ver abajo).

### `event_games`

`id, event_id (FK events.id), game_id (FK games.id), registration_mode, cupo_maximo`.

- `registration_mode`: text, nullable, **creada manualmente en Supabase**. Valores permitidos:
  `individual | team | both | NULL`. Ver "Columnas nuevas creadas manualmente" y
  `docs/inscripciones.md` (sección "Modalidad de inscripción por juego") para el detalle completo
  de semántica y fallback de `NULL`.
- `cupo_maximo`: integer, nullable, `check (cupo_maximo is null or cupo_maximo >= 0)`. Agregada en
  `supabase/migrations/20260824_event_game_cupos.sql`. `NULL` = sin límite (comportamiento
  histórico). `0` = juego cerrado a nuevas inscripciones en ese evento. Cuenta **personas**, no
  equipos ni inscripciones — ver "Cupos máximos por evento+juego" más abajo y
  `docs/inscripciones.md`.
- **`UNIQUE(event_id, game_id)`** (`event_games_event_id_game_id_key`), agregada en la misma
  migración: no existía antes, hacía falta para que el conteo de cupo no duplicara filas si alguna
  vez hubiera dos `event_games` para el mismo par evento+juego (nada en el código genera eso hoy,
  pero tampoco había nada que lo impidiera). Ver "Cupos máximos..." más abajo.

### `event_games_days`

`id, event_game_id (FK event_games.id), date`. Opcional — usada solo para eventos de varios días
donde un juego no se juega todos los días.

### `inscriptions`

Según el spec original: `id, user_id, nombre, apellido, email, celular, localidad, created_at,
edad, id_evento (FK events.id), team_name, qr_code, asistencia, fecha_asistencia,
steam_username, riot_id`.

Para inscripciones de **presentación**: `team_name`, `steam_username`, `riot_id`, `qr_code` quedan
en `null`/no se setean en el insert inicial (`qr_code` se completa después con un `update`, igual
que en torneo).

### `games_inscriptions`

`id, id_inscription (FK inscriptions.id), id_game (FK games.id)`. No se inserta nada acá para
eventos `tipo = 'presentacion'` (no hay juego que asociar).

### `invalid_emails`, `profiles`

Sin cambios relacionados a esta feature. `profiles.role` se usa para `is_admin()` / validación de
rutas admin (`api/_lib/requireAdmin.js`), no interviene en el flujo público de inscripción.

## Tipo real de las columnas de ID: `uuid`, no `bigint`

**Confirmado tras un intento real de aplicar `supabase/migrations/20260824_event_game_cupos.sql`**,
que falló contra la base real con `ERROR: 42883: operator does not exist: uuid = bigint` en una
comparación de `event_games.event_id`. Hasta ese momento todo este documento (y el resto de las
migraciones del repo) asumía `bigint generated by default as identity` para los IDs de
`events`/`games`/`inscriptions`/`event_games`/`games_inscriptions` — el mismo default que sí se usó
deliberadamente para `gallery_items` (única tabla de este repo creada por una migración versionada,
ver `20260810_gallery_items.sql`), pero **nunca confirmado** para el resto porque no hay ninguna
migración de creación versionada para esas cinco tablas.

**Estado real, por nivel de certeza** (detalle completo del razonamiento en el encabezado de
`supabase/migrations/20260824_event_game_cupos.sql`):

| Columna | Tipo real | Certeza |
|---|---|---|
| `event_games.event_id` | `uuid` | **Probado** — el error de Postgres de arriba, no inferencia |
| `events.id` | `uuid` | Probado con certeza muy alta — ver más abajo |
| `inscriptions.id_evento` | `uuid` | Probado con certeza muy alta — ver más abajo |
| `games.id`, `event_games.id`, `event_games.game_id`, `inscriptions.id`, `games_inscriptions.id`, `games_inscriptions.id_inscription`, `games_inscriptions.id_game` | `uuid` | Inferido por consistencia de esquema (sin evidencia en contra) |

La prueba de certeza muy alta para `events.id`/`inscriptions.id_evento`:
`src/components/pages/VerifyAttendance.jsx:88` hace
`if (inscripcion.id_evento !== eventoId)` con `!==` **estricto** de JavaScript, comparando el valor
ya traído de Supabase contra `eventoId` de `useParams()` de react-router — que siempre es `string`.
Si `id_evento` fuera numérico, esa comparación nunca podría dar `true`, y esta pantalla (verificación
de asistencia por QR, ya en producción) fallaría el 100% de las veces. Para que funcione como
funciona hoy, `id_evento` tiene que serializarse como string.

Para el resto (`games.id`, PKs/FKs de `event_games`/`games_inscriptions`), se revisó **todo** `src/`
buscando contraevidencia (`parseInt`/`Number()` sobre cualquier `id`, aritmética u ordenamiento
numérico de ids) — cero resultados en todo el proyecto. Un esquema mixto (algunas tablas `uuid`,
otras `bigint`, sin ningún motivo documentado) sería un patrón muy inusual; se asume que todo el
esquema comparte la convención `uuid`.

**Impacto en `20260824_event_game_cupos.sql`**: los parámetros/arrays/retornos que antes eran
`bigint`/`bigint[]` pasaron a `uuid`/`uuid[]` — `register_team_inscription(p_event_id, p_game_id,
...)`, `get_event_game_cupos(p_event_ids uuid[])`. El trigger `enforce_event_game_cupo()`
(Sección 3) **no necesitó ningún cambio**: usa `record`/comparaciones columna-contra-columna en vez
de tipos fijos, así que ya era agnóstico al tipo real. Donde no hacía falta un tipo concreto para el
`GRANT EXECUTE`, se usó `%TYPE` contra la columna real en vez de volver a asumir (`inscriptions.id%TYPE`,
`event_games.event_id%TYPE`, etc.) — para que el código no dependa de haber adivinado bien esta vez
tampoco. No se agregó ningún cast artificial: donde había una comparación `uuid = bigint` rota, ahora
hay `uuid = uuid` real.

**Recomendación para cerrar esto definitivamente**: correr
`select table_name, column_name, data_type from information_schema.columns where table_name in
('events','games','inscriptions','event_games','games_inscriptions') and column_name like '%id%'
order by table_name, column_name;` contra la base real (la prueba 0 de
`supabase/tests/20260824_event_game_cupos_manual_tests.sql` ya la incluye) — es la única forma de
pasar de "probado con certeza muy alta"/"inferido" a "confirmado" para las columnas que todavía no
tienen una prueba tan directa como el error real que sí tuvo `event_games.event_id`.

## Migración relacionada a "torneo vs presentación"

El archivo `supabase/migrations/20260701_add_event_tipo.sql` **existió en el repo y fue borrado en
el commit `6d98422`** (el mismo commit que ajustó el email de confirmación para excluir
presentaciones). Se recupera acá su contenido para que quede documentado, ya que probablemente ya
se corrió a mano en el SQL Editor de Supabase (así lo pedía el spec original, que aclaraba
explícitamente que las migraciones debían dejarse en un `.sql` para correrlas manualmente, no
ejecutarlas desde el agente):

```sql
-- Tipo de evento: torneo (default) o presentacion
alter table events add column tipo text not null default 'torneo'
  check (tipo in ('torneo', 'presentacion'));

-- Si el evento no debe listarse en la home (presentaciones por defecto no se listan)
alter table events add column visible_en_home boolean not null default true;

-- Fecha/hora límite opcional para cierre automático de inscripción
alter table events add column fecha_cierre_inscripcion timestamptz;
```

**No se restauró el archivo** en esta revisión para no asumir que sigue haciendo falta (si ya se
corrió en Supabase, el archivo era solo un registro histórico). Si querés mantener un historial de
migraciones en el repo, decime y lo recreo tal cual.

## Columnas nuevas creadas manualmente en Supabase (`events.nombre`, `event_games.registration_mode`)

A diferencia de `tipo`/`visible_en_home`/`fecha_cierre_inscripcion` (que sí tuvieron una migración
`.sql`, aunque después se haya borrado del repo — ver arriba), estas dos columnas **ya fueron
creadas manualmente en Supabase antes de adaptar el código**, según indicación explícita: no hay
ningún `ALTER TABLE` que ejecutar para crearlas, el código de esta revisión asume que ya existen.
Se documentan acá solo a fines de referencia (no como una migración pendiente):

```sql
-- events.nombre — ya existe en Supabase, no ejecutar
-- alter table events add column nombre text;

-- event_games.registration_mode — ya existe en Supabase, no ejecutar
-- alter table event_games add column registration_mode text
--   check (registration_mode in ('individual', 'team', 'both'));
```

El `CHECK` de `registration_mode` permite `individual`, `team`, `both` o `NULL` (un `CHECK` de
Postgres deja pasar `NULL` salvo que la columna sea además `NOT NULL`, que no es el caso acá — así
que `NULL` es un cuarto valor válido en la práctica, usado como "sin migrar", ver
`docs/inscripciones.md`).

**Verificación recomendada** (no asumido, para que lo confirmes vos): correr
`select column_name, data_type, is_nullable from information_schema.columns where table_name in
('events', 'event_games') and column_name in ('nombre', 'registration_mode');` en el SQL Editor y
confirmar que el tipo es `text` y `is_nullable = YES` en ambos casos, y que existe el `CHECK` sobre
`registration_mode` (`select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid =
'event_games'::regclass and contype = 'c';`).

## Protección en Supabase: `UNIQUE(events.slug)`

**Causa raíz confirmada** (julio 2026): existían dos filas en `events` con el mismo `slug` (mismo
lugar + fecha, formato de slug viejo sin correlativo). `SeleccionInscripcion.jsx` hace
`.eq('slug', eventoSlug).single()`, y `.single()` exige exactamente una fila — con 2 devolvía
`PGRST116`, que el código trataba igual que "evento no encontrado" y mandaba al usuario a Home a
mitad de la inscripción. Se resolvió a mano borrando uno de los dos registros.

El código ahora reduce mucho la probabilidad de que vuelva a pasar (nuevo formato de slug con
`tipo` + correlativo ante colisión, ver `docs/eventos.md`, y el submit del alta bloqueado durante el
guardado para evitar dobles clicks), pero **la única protección definitiva contra condiciones de
carrera es una restricción `UNIQUE` en la base** — el chequeo del frontend es "leer, después
escribir", no atómico.

Se agregó la migración `supabase/migrations/20260730_events_slug_unique.sql` (el repo sí tiene
carpeta `supabase/migrations/`, con el mismo patrón de nombre `YYYYMMDD_descripcion.sql` que ya se
usaba). **No se ejecutó ni se asume aplicada** — hay que correrla a mano en el SQL Editor de
Supabase, en este orden:

### 1) Detectar slugs duplicados

```sql
select slug, count(*) as cantidad
from events
group by slug
having count(*) > 1;
```

Si esto no devuelve filas, se puede pasar directo al paso 3.

### 2) Inspeccionar los registros afectados

Por cada slug que haya aparecido en el paso 1 (reemplazando `'EL-SLUG-DUPLICADO'`):

```sql
select e.*,
       exists (
           select 1 from inscriptions i where i.id_evento = e.id
       ) as tiene_inscripciones
from events e
where e.slug = 'EL-SLUG-DUPLICADO'
order by e.created_at;
```

Sirve para decidir cuál fila conservar: en general, no conviene borrar la que tenga
`tiene_inscripciones = true`. Si ambas tienen inscripciones asociadas (los dos eventos "reales"
efectivamente coexistieron con el mismo slug), no se puede simplemente borrar una — hay que
renombrarle el slug a mano a una de las dos (agregándole un sufijo, por ejemplo) antes de aplicar
el `UNIQUE`.

### 3) Aplicar la restricción

Recién después de resolver todos los duplicados que haya reportado el paso 1:

```sql
alter table events add constraint events_slug_unique unique (slug);
```

Si en ese momento todavía queda algún duplicado, este `ALTER TABLE` va a fallar con un error de
Postgres explícito (no en silencio) — es la señal de que falta resolver algo del paso 2.

**Importante:** esto no obliga a que los slugs viejos (formato `lugar-fecha`, sin tipo) cambien de
forma. La restricción solo exige que no se repita ningún valor de `slug`, sin importar su formato —
los eventos históricos siguen funcionando tal cual están.

## Reglas configurables por evento: triggers de validación (edad y máximo de juegos)

Migración `supabase/migrations/20260804_event_participation_rules.sql`. Agrega
las 4 columnas de `events` de la tabla de arriba y dos triggers — es la
**primera vez que este proyecto usa triggers de Postgres** para validar reglas
de negocio (hasta ahora todo era `CHECK` sobre columnas enum o validación
exclusiva de frontend). Ver `docs/inscripciones.md` para el flujo completo.

### `trg_validate_participant_age` (`BEFORE INSERT ON inscriptions FOR EACH ROW`)

Rechaza el insert si el evento (`NEW.id_evento`) tiene `edad_minima`/`edad_maxima`
configuradas y la edad del participante (`NEW.edad`) no las cumple. Cubre
individual, capitán de equipo y cada jugador del equipo por igual, porque los
tres se insertan como filas independientes de `inscriptions` (verificado en
`Confirmacion.jsx`/`ConfirmacionEquipo.jsx` antes de escribir el trigger, no
asumido). Errores identificables (mensaje de la excepción + `errcode` custom):

| Marcador | errcode | Cuándo |
|---|---|---|
| `INVALID_PARTICIPANT_AGE` | `LCE01` | `edad` ausente, no numérica, o negativa |
| `EVENT_MINIMUM_AGE_NOT_MET` | `LCE02` | por debajo de `edad_minima` |
| `EVENT_MAXIMUM_AGE_EXCEEDED` | `LCE03` | por encima de `edad_maxima` |

**Supuesto no verificado contra la base real**: el trigger asume que
`inscriptions.edad` es texto (así la manda siempre el frontend) y hace un
cast defensivo (`::text` antes de `::integer`, con `BEGIN/EXCEPTION` alrededor
para no dejar pasar un error de cast genérico). Funciona igual si la columna
ya fuera `integer`, pero no se pudo confirmar el tipo real sin acceso directo
a Supabase desde este entorno.

### `trg_enforce_event_game_limit_insert` / `trg_enforce_event_game_limit_update`

Rediseñado tras la primera versión de la migración, que usaba `BEFORE INSERT
FOR EACH ROW` y dependía de que un trigger de fila pudiera ver, vía `SELECT`,
las filas hermanas ya procesadas de un mismo `INSERT` multi-fila (caso real:
la inscripción individual inserta todos sus juegos en un solo
`.insert(gameRows)`, ver `Confirmacion.jsx`). Ese supuesto nunca se verificó
contra una instancia real y es frágil por depender de un detalle interno de
ejecución fila por fila.

El diseño actual es un **trigger de sentencia** con **tabla de transición**
(`REFERENCING NEW TABLE AS inserted_games`, disponible desde Postgres 10):
en vez de mirar fila por fila durante el `INSERT`, corre una sola vez
**después** de que toda la sentencia terminó, y evalúa el estado definitivo.

**Dos triggers, no uno combinado.** Postgres no permite declarar un único
trigger como `AFTER INSERT OR UPDATE ... REFERENCING NEW TABLE`: cuando un
trigger lista más de un evento, no puede pedir tabla de transición — hay que
usar un trigger separado por cada evento que la necesite (restricción
documentada de `CREATE TRIGGER`). Por eso hay **dos triggers independientes**
que reutilizan la misma función `enforce_event_game_limit()`:

- `trg_enforce_event_game_limit_insert` — `AFTER INSERT ON games_inscriptions REFERENCING NEW TABLE AS inserted_games FOR EACH STATEMENT`.
- `trg_enforce_event_game_limit_update` — `AFTER UPDATE ON games_inscriptions REFERENCING NEW TABLE AS inserted_games FOR EACH STATEMENT`.

La función no necesita distinguir cuál de los dos la invocó (no lee
`TG_OP`): en ambos casos recibe `inserted_games` con las filas nuevas de la
sentencia (para un UPDATE, con los valores de destino después del cambio) y
opera igual, sin importar cuántas filas ni a cuántas inscripciones distintas
tocó:

1. Identifica todas las inscripciones tocadas por la sentencia:
   `select distinct id_inscription from inserted_games`.
2. Bloquea esas inscripciones una por una, en orden ascendente por `id`
   (`select ... for update`), antes de contar nada — el orden determinístico
   evita deadlocks entre dos sentencias concurrentes que bloqueen el mismo
   conjunto de inscripciones en órdenes distintos.
3. Con los locks tomados, cuenta el total real de `games_inscriptions` por
   cada inscripción afectada, cruzando con `events` para aplicar el filtro
   solo donde corresponde: `modo_seleccion_juegos = 'libre'` **y**
   `max_juegos_por_participante is not null`. Cualquier inscripción de un
   evento `'clasificado'`, o `'libre'` sin máximo, queda afuera del cálculo
   por el propio `JOIN`/`WHERE` — el trigger nunca puede rechazar nada para
   esos casos.
4. Si alguna inscripción quedó con más juegos que su máximo, lanza
   `EVENT_GAME_LIMIT_EXCEEDED` (`errcode LCE04`) y Postgres revierte la
   sentencia **completa** (estándar de un trigger `AFTER STATEMENT`: si
   falla, deshace todo lo que esa sentencia había hecho) — no quedan filas
   parciales de ningún participante ni de ninguna inscripción del lote,
   aunque solo una de varias haya excedido el máximo.

`trg_enforce_event_game_limit_update` cubre un `UPDATE` que reasigne
`id_inscription` o `id_game` de una fila existente: la inscripción de
DESTINO (adonde queda la relación después del cambio) es la que aparece en
`inserted_games`, así que queda incluida en el cálculo del paso 1 igual que
cualquier inscripción tocada por un INSERT — no hace falta lógica aparte
para distinguir "de dónde vino" la fila. Hoy el código de la app nunca hace
`UPDATE` sobre `games_inscriptions` — se cubre de todas formas para que la protección sea
real contra cualquier request directa, no solo contra el `INSERT` que usa
hoy el frontend.

**Concurrencia**: dos transacciones agregando juegos a la misma inscripción
se serializan por el `select ... for update` del paso 2 — la segunda queda
bloqueada hasta que la primera hace commit o rollback, y recién ahí cuenta
el total real combinado (sus propias filas + las ya committeadas de la
otra). Esto **se probó únicamente con dos sesiones SQL manuales** (ver
`supabase/tests/20260804_event_participation_rules_manual_tests.sql`,
sección "Concurrencia") — no es un análisis solo estático del diseño.

### Restricción UNIQUE aplicada: `games_inscriptions_inscription_game_key (id_inscription, id_game)`

A diferencia de la primera versión de la migración (que dejaba esto
**comentado**), ahora la migración misma comprueba si existen duplicados de
`(id_inscription, id_game)` mediante un bloque `do $$ ... $$` y, si encuentra
alguno, aborta con `raise exception` (marcador
`GAMES_INSCRIPTIONS_DUPLICATE_ROWS_FOUND`, `errcode LCE05`) — sin borrar,
fusionar ni modificar ninguna fila automáticamente. Como toda la migración
corre dentro de una única transacción explícita (`begin;` / `commit;`), ese
aborto revierte también las Secciones 1-3 (columnas, trigger de edad, trigger
de límite de juegos): o se aplica todo el archivo, o no se aplica nada. Si no
hay duplicados, agrega la restricción real
`unique (id_inscription, id_game)`.

## Cupos máximos por evento+juego (`event_games.cupo_maximo`)

Migración `supabase/migrations/20260824_event_game_cupos.sql`. Ver
`docs/inscripciones.md` (sección "Cupos máximos por evento+juego" e
"Inscripción atómica de equipos") para el detalle funcional completo — acá
solo el detalle de esquema/función/triggers/RPC.

### `trg_enforce_event_game_cupo_insert` / `trg_enforce_event_game_cupo_update`

Mismo patrón que `trg_enforce_event_game_limit_insert/_update`
(`20260804_event_participation_rules.sql`): trigger de **sentencia** (no de
fila) sobre `games_inscriptions`, con tabla de transición
(`REFERENCING NEW TABLE AS inserted_games`), dos triggers separados porque
Postgres no permite combinar INSERT/UPDATE en un solo trigger con tabla de
transición. Ambos reutilizan `enforce_event_game_cupo()`.

Diferencia de diseño respecto al trigger de máximo de juegos: acá el recurso
que hay que bloquear antes de contar no es una fila de `inscriptions` sino la
fila de **`event_games`** del par (evento, juego) afectado — es el recurso
compartido entre todas las inscripciones que elijan ese juego en ese evento,
no algo por-inscripción. La función:

1. Resuelve los pares `(event_id, game_id)` afectados por la sentencia
   (`inserted_games` → `id_game` directo, `event_id` vía
   `inscriptions.id_evento`).
2. Bloquea (`select ... for update`) la fila de `event_games` de cada par, en
   orden determinístico (`order by event_id, game_id`), antes de contar —
   serializa altas concurrentes al mismo evento+juego.
3. **(Agregado en auditoría de seguridad posterior, antes de aplicar la
   migración)**: si algún par NO tiene fila en `event_games`, rechaza con
   `EVENT_GAME_NOT_CONFIGURED` (`errcode LCE10`) en vez de dejarlo pasar en
   silencio. La primera versión de esta función simplemente no bloqueaba
   nada para un par sin configurar y seguía de largo — eso permitía esquivar
   el cupo real de un juego llamando directo a Supabase con un `id_game` que
   no correspondiera al evento (ver la sección de auditoría en
   `docs/inscripciones.md`). Protege por igual al flujo individual y al de
   equipo — `register_team_inscription` hace la misma verificación por
   adelantado, antes de insertar nada, para un error más rápido y
   específico, pero este chequeo del trigger es el que cierra el hueco para
   cualquier otro camino de inserción (incluido el flujo individual actual).
4. Cuenta el total real de **personas** (`games_inscriptions` unidas a
   `inscriptions` del mismo evento) por cada par cuyo `cupo_maximo` no sea
   `NULL`, y compara.
5. Si algún par excede su cupo, `raise exception 'EVENT_GAME_CUPO_EXCEEDED'`
   (`errcode LCE06`) — Postgres revierte la sentencia completa.

**Concurrencia y UPDATE — verificado formalmente en la auditoría**: el lock
es por `(event_id, game_id)`, nunca por fila de `games_inscriptions` — dos
inscripciones a juegos DISTINTOS (mismo evento o no) nunca compiten por el
mismo lock y no se bloquean entre sí. El orden `order by event_id, game_id`
es el mismo criterio anti-deadlock que ya usa `enforce_event_game_limit()`:
si una sentencia toca más de un par (event_id, game_id) — por ejemplo el
INSERT multi-fila de `register_team_inscription` cuando en el futuro un
equipo pudiera anotarse a más de un juego a la vez, cosa que hoy no hace,
solo usa un `p_game_id` — bloquearlos siempre en el mismo orden ascendente
garantiza que dos sentencias concurrentes nunca puedan esperarse en un ciclo.
Para el `UPDATE`, el conteo siempre lee el estado ACTUAL de la tabla después
de la sentencia (no acumula "fila vieja + fila nueva"), así que mover una
fila ya existente hacia otro juego, o tocarla sin cambiar nada, nunca cuenta
esa fila dos veces — confirmado con pruebas dedicadas nuevas (16a-16c) en
`supabase/tests/20260824_event_game_cupos_manual_tests.sql`.

**`SECURITY DEFINER`** (a diferencia de `enforce_event_game_limit()`, que no
lo usa): `SELECT ... FOR UPDATE` requiere privilegio de `UPDATE` en la tabla
en Postgres, no solo `SELECT`. No queremos otorgarle a `anon`/`authenticated`
un `GRANT UPDATE` real sobre `event_games` (tabla de configuración
administrada por el panel admin: modalidad, cupo) solo para que el lock
funcione. Declarando la función `SECURITY DEFINER` (dueño = el rol que corre
la migración), el lock corre con privilegios elevados sin abrir ningún
permiso nuevo al rol que dispara el `INSERT`. `search_path` fijo
(`public, pg_temp`) por higiene estándar de funciones `SECURITY DEFINER`.

**No verificado contra la base real** (mismo aviso que el resto de este
documento): si `event_games`/`inscriptions`/`games_inscriptions` tienen RLS
habilitado con políticas restrictivas, `SECURITY DEFINER` hace que no
importe — la función lee/bloquea con los privilegios de su dueño, no los del
rol que llama. Falta confirmar igual que el dueño de la función (quien corre
la migración en el SQL Editor) tenga privilegios suficientes sobre esas tres
tablas — normalmente sí, si se corre con el rol admin/postgres por defecto
del proyecto.

### `register_team_inscription(p_event_id, p_game_id, p_captain, p_players)`

RPC (`supabase.rpc('register_team_inscription', {...})`) que reemplaza, del
lado de la base, la secuencia de `insert`s sueltos que hacía
`ConfirmacionEquipo.jsx` (uno por integrante). Inserta capitán + jugadores +
`games_inscriptions` **dentro de una única llamada** — y por lo tanto una
única transacción implícita de Postgres: cualquier excepción no capturada
(el trigger de edad sobre cualquier integrante, el chequeo de
evento+juego/modalidad de abajo, o el trigger de cupo al insertar
`games_inscriptions`) revierte TODO lo que la función llevaba hecho, sin
dejar ningún integrante guardado. Ver `docs/inscripciones.md`, "Inscripción
atómica de equipos", para el detalle completo (incluido por qué NO
reimplementa validación de edad/cupo, sino que las reutiliza disparando los
mismos triggers existentes).

`SECURITY INVOKER` (default, sin declarar): a diferencia de la función de
cupo, esta sí escribe filas con datos personales — corre con los mismos
privilegios que ya tiene el rol que llama (`anon`/`authenticated`), sin
ningún permiso adicional a los que ya requiere el flujo actual de inserts
directos. `grant execute ... to anon, authenticated` (necesario para que
PostgREST la exponga como RPC a esos roles).

**Auditada como si fuera un usuario malicioso llamándola directa desde el
navegador** (`supabase.rpc('register_team_inscription', {...})` es una POST
HTTP normal, cualquiera puede armarla a mano con la `anon key`, que ya viaja
en el bundle público del sitio). Dos hallazgos reales, corregidos antes de
aplicar la migración:

1. **Suplantación de usuario vía `p_user_id`.** La primera versión recibía
   `p_user_id uuid` del cliente y lo insertaba tal cual en
   `inscriptions.user_id` — igual que ya hacía `ConfirmacionEquipo.jsx`
   (`user_id: user.id` desde el estado de React). Nada ataba ese parámetro a
   la sesión real: cualquiera podía mandar el UUID de otra persona y
   asociarle una inscripción sin su contraseña ni su sesión. **Corregido**:
   el parámetro se eliminó de la firma; la función ahora resuelve
   `v_user_id uuid := auth.uid();` — se confirmó primero que el proyecto usa
   el cliente estándar de `@supabase/supabase-js` con sesión persistida
   (`src/utils/supabase.js`, `src/context/AuthProvider.jsx`:
   `supabase.auth.getSession()` / `onAuthStateChange`), así que cada request
   ya lleva un JWT real de Supabase Auth, y `auth.uid()` lee el `sub` de ESE
   JWT del lado del servidor — fuera del alcance de lo que el cliente puede
   falsificar. `NULL` para sesión anónima, misma semántica que el
   `user?.id ?? null` que ya usaba el frontend. Comportamiento observable
   sin cambios para uso legítimo, deja de ser falsificable para uso
   malicioso.
2. **Bypass de cupo con un `game_id` que no corresponde al evento.** Ver el
   punto 3 del diseño de `enforce_event_game_cupo()` arriba
   (`EVENT_GAME_NOT_CONFIGURED`, `errcode LCE10`) — esta función hace la
   MISMA verificación por adelantado (join `event_games`+`games` por
   `(p_event_id, p_game_id)`, `if not found then raise exception`), antes de
   insertar nada, para fallar rápido con un mensaje específico de equipo. De
   paso resuelve también "pasar un `event_id` y un `game_id` que no
   correspondan" e "inscribir en un evento inexistente": un `p_event_id`
   inexistente nunca va a tener fila en `event_games`, así que cae en el
   mismo `EVENT_GAME_NOT_CONFIGURED`.
3. **Crear un equipo en un juego que solo admite inscripción individual.**
   La misma consulta que resuelve el punto anterior trae también
   `registration_mode`/`team_option`, y calcula el modo efectivo con el
   MISMO fallback que ya usa el frontend
   (`getEffectiveRegistrationMode`, `src/utils/registrationMode.js`:
   `registration_mode ?? (team_option ? 'both' : 'individual')`). Si el modo
   efectivo es `'individual'`, rechaza con `TEAM_NOT_ALLOWED_FOR_GAME`
   (`errcode LCE11`) antes de insertar nada. Esta regla NO tenía ninguna
   protección del lado de la base para NINGÚN flujo antes de esta auditoría
   (solo se filtraba en el frontend, `SeleccionInscripcion.jsx`) — se agregó
   acá, específicamente adentro de la función de equipo (no en el trigger
   general), porque solo el flujo de equipo puede violar esta regla por
   construcción.

**Verificado y confirmado SIN cambios necesarios** (para que quede
registrado qué se revisó, no solo qué se corrigió):

- **Fabricar IDs**: el `id` de cada fila de `inscriptions` sale siempre del
  identity/serial de la columna — la función nunca lee un `id` del JSON de
  entrada, así que no hay forma de que el llamador fuerce un `id`
  específico ni de que reutilice el de otra fila.
- **Duplicar participantes**: no hay ninguna restricción de unicidad de
  persona (email, teléfono) en `inscriptions` para NINGÚN flujo — es una
  característica preexistente de todo el sistema, no algo que esta RPC
  empeore. No se agregó una regla nueva para esto (fuera del alcance
  pedido: "no agregar reglas de producto que el sistema no tenga").
- **Introducir campos que el usuario no debería controlar**: se revisaron
  las dos listas de columnas de `insert into inscriptions (...)` (capitán y
  jugador) — ninguna incluye `id`, `qr_code`, `asistencia` ni `created_at`;
  esas siguen fuera del alcance de lo que el JSON de entrada puede tocar,
  igual que en el flujo directo anterior.
- **Cantidades/estructuras inválidas de `p_players`**: si no es un array
  JSON válido, `jsonb_array_elements` lo rechaza con un error de Postgres
  (no corrompe datos, solo falla la llamada completa) — no se agregó un
  límite artificial de cantidad de jugadores por equipo, porque no existe
  hoy como regla de producto y el cupo real ya limita cuántos pueden
  terminar aceptados.
- **Evento cerrado / `inscripciones_abiertas` / `fecha_cierre_inscripcion`
  / evento vencido**: **NO está protegido a nivel de base para NINGÚN
  flujo** (individual o equipo, con o sin esta RPC) — es una validación
  exclusivamente de `SeleccionInscripcion.jsx` (frontend). Esto es un
  riesgo preexistente, no introducido ni empeorado por esta RPC (el flujo
  directo de `Confirmacion.jsx` ya tenía exactamente la misma exposición).
  Deliberadamente NO se corrigió acá: cerrar este hueco requeriría una
  decisión de producto (qué trigger, sobre qué tabla, con qué criterio
  exacto) y tocaría por igual al flujo individual, que quedó fuera del
  alcance de esta tarea — queda documentado como pendiente explícito, ver
  `docs/inscripciones.md`.

No genera `qr_code` — eso se sigue haciendo en el cliente
(`generateQRString` + un `update` puntual por fila, igual que hoy) después de
que el RPC devuelve los IDs de las filas insertadas.

### `get_event_game_cupos(p_event_ids uuid[])`

RPC de solo lectura, usada por `useEventGames(eventIds)` para traer
`cupo_maximo`/`ocupados`/`disponibles` por `(event_id, game_id)` de una sola
vez para todos los eventos pedidos, en vez de un `count()` por juego desde el
cliente. `SECURITY DEFINER` deliberado: necesita leer `inscriptions` sin
depender de que `anon` tenga `SELECT` vía RLS sobre esa tabla (no confirmado,
ver "RLS / permisos" abajo) — pero **solo** devuelve agregados numéricos
(nunca una fila de `inscriptions` ni ningún dato personal), así que no hay
forma de que filtre información sensible sin importar quién la llame.
`stable` (solo lectura, sin efectos colaterales). `grant execute ... to anon,
authenticated`.

## RLS / permisos

El código no incluye ningún archivo `.sql` con `create policy`, y el cliente del frontend
(`src/utils/supabase.js`) usa siempre la `anon key`. Lo único documentado sobre RLS en el repo es
el spec `claude/commands/fix-rls-api-admin.md`, que:

- Confirma que **RLS está habilitado** en al menos algunas tablas (menciona `invalid_emails`,
  `profiles`) y que existe una función `is_admin()`.
- Indica que las rutas `/api/admin/*` deben usar la `service_role key` (bypassea RLS) más una
  verificación explícita de admin en el código — esto es para los endpoints de mail masivo, no
  afecta el flujo público de inscripción.
- No dice nada sobre políticas de `events` ni `inscriptions` para el rol `anon`.

**No podemos confirmar desde el código si `events` o `inscriptions` tienen RLS habilitado**, ni con
qué política. Si lo tienen y la política de `SELECT` sobre `events` depende de alguna de las
columnas nuevas (`tipo`, `visible_en_home`, `inscripciones_abiertas`) de forma más restrictiva que
"cualquiera puede leer cualquier evento por su slug", eso explicaría una redirección a Home
intermitente en el fetch de `SeleccionInscripcion.jsx` sin que haya nada mal en el código React.

### Límite de filas por request (PostgREST) — ya mordió a esta app más de una vez

Supabase/PostgREST trunca silenciamente cualquier `select` a un máximo de filas por request
configurado a nivel de proyecto (Dashboard → Settings → API). Esta app ya se topó con esto antes:
`InscriptionsList.jsx` y `EmailMasivo.jsx` paginan explícitamente con un cursor (`const BATCH =
1000`) para poder leer *toda* la tabla `inscriptions` sin perder filas. La consulta que arma la
columna "Inscriptos" en `EventsList.jsx` no tenía ese resguardo y sufría el mismo problema —
corregido en esta revisión reusando el mismo patrón de paginación (ver `docs/eventos.md`).

**Recomendación general:** cualquier `select` nuevo contra una tabla que pueda crecer sin límite
(`inscriptions` es la candidata obvia acá) debería paginar por cursor desde el principio, en vez de
asumir que un solo request trae todo. No hay forma de detectar esto solo mirando el código — si
alguna vez el número real de filas queda por debajo del límite configurado, la consulta "funciona
bien" en las pruebas y solo falla más adelante, a medida que crecen los datos.

### Nueva dependencia de RLS: eliminación de eventos desde el admin

La función de borrado agregada en esta revisión (`EventsList.jsx` → `handleDeleteEvent`) corre
directo contra Supabase **desde el cliente del frontend** (la `anon key` + la sesión del admin
logueado, igual que el resto de `EventsList.jsx`), no a través de una API route con
`service_role key`. Para que funcione, la sesión de un usuario admin necesita permiso de:

- `DELETE` en `events`.
- `DELETE` en `event_games`.
- `SELECT` en `inscriptions` (para el chequeo `id_evento = ...` antes de borrar).

Si estas tablas tienen RLS habilitado sin una policy que cubra `DELETE`/`SELECT` para el rol
`authenticated` (o para quien pase `is_admin()`, siguiendo el mismo patrón que
`claude/commands/fix-rls-api-admin.md` describe para las API routes), el botón "Eliminar" va a
fallar con un error de permisos — no vas a ver un `PGRST` de datos, sino algo como "new row
violates row-level security policy" o un 401/403 de Postgres. Si eso pasa, hay que agregar (o
ajustar) las policies correspondientes; no se puede resolver desde el código del frontend.

**Se suma en esta revisión**: las restricciones para editar `registration_mode` y para quitar un
juego del evento (ver `docs/inscripciones.md`) hacen, con la misma sesión de frontend, `SELECT`
sobre `games_inscriptions` (antes solo se leía `inscriptions`) para saber qué juegos de un evento ya
tienen participantes. Si `games_inscriptions` tiene RLS sin policy para el admin, el chequeo va a
fallar — y, como está diseñado en modo *fail-closed*, el efecto va a ser que **ningún** selector de
modalidad ni checkbox de juego se pueda tocar (mensaje "no se pudo verificar"), no que se editen o
quiten a ciegas. Es un síntoma molesto pero seguro; si pasa, hay que revisar las policies de
`games_inscriptions` para el rol admin.

**Cupos (esta revisión, `20260824_event_game_cupos.sql`)**: a diferencia de lo anterior, la función
de validación de cupo (`enforce_event_game_cupo`) y el RPC de lectura de disponibilidad
(`get_event_game_cupos`) se declararon `SECURITY DEFINER` específicamente para no depender de que
RLS le dé a `anon`/`authenticated` acceso de lectura/lock sobre `event_games`/`inscriptions` — ver
"Cupos máximos por evento+juego" más arriba para el detalle y la justificación de por qué esto no
abre ningún permiso de más (una nunca escribe filas, la otra solo devuelve agregados no sensibles).
El RPC de escritura (`register_team_inscription`) sigue siendo `SECURITY INVOKER`, así que si
`inscriptions`/`games_inscriptions` tienen RLS restrictivo para `INSERT`, este RPC va a fallar
exactamente igual que ya fallaría hoy el flujo directo de `ConfirmacionEquipo.jsx` — no hay cambio
de superficie de permisos ahí.

## Discrepancias encontradas

1. **Migración borrada sin dejar rastro en el repo** (ver arriba) — riesgo de que, si en algún
   momento hay que recrear la base o revisar qué se corrió, no quede registro.
2. ~~`slug` sin unicidad garantizada por el código.~~ **Confirmado como causa raíz real de un
   incidente en producción** (dos eventos con el mismo slug, `.single()` fallando con `PGRST116`).
   Mitigado del lado del código en esta revisión (slug con `tipo` + correlativo, submit bloqueado
   durante el guardado) y con la migración `20260730_events_slug_unique.sql` preparada — **sigue
   pendiente que el administrador la corra** (ver "Protección en Supabase" arriba) para tener la
   protección definitiva contra condiciones de carrera.
3. **Segunda fuente de verdad para el evento durante el flujo.** `Formulario.jsx`,
   `FormularioEquipo.jsx`, `VerificacionSteam.jsx` y `VerificacionRiot.jsx` no reciben el evento ya
   cargado por `SeleccionInscripcion.jsx` — cada uno vuelve a pedirlo por `id` con
   `useEventoSeleccionado`. Si esa segunda consulta falla (mismo tipo de causas: RLS, red), esos
   componentes no redirigen a ningún lado, simplemente renderizan con `eventoSeleccionado` en
   `null` (localidad/fecha vacíos en el header del paso) — es un bug distinto (UI rota, no
   redirect) pero comparte la misma raíz potencial (permisos/errores silenciosos contra `events`).
4. ~~Sacar un juego de un evento que ya tiene inscripciones no está protegido.~~ **Corregido en la
   revisión siguiente**: `EventsList.jsx` → `saveChanges` sigue borrando **todas** las filas de
   `event_games` del evento y reinsertando solo las tildadas, pero ahora, antes de hacerlo, valida
   que ningún juego que se esté sacando tenga inscripciones asociadas (misma relación
   `inscriptions.id_evento` + `games_inscriptions.id_game` que ya se usaba para la modalidad) — si
   las tiene, frena todo el guardado. También se bloquea visualmente el checkbox correspondiente en
   `EditEventModal`. Ver el detalle completo en `docs/inscripciones.md` ("Restricción para quitar un
   juego con inscripciones existentes del evento").

## Qué verificar manualmente en Supabase (no se puede confirmar desde el código)

1. **RLS de `events`**: `select * from pg_policies where tablename = 'events';` — confirmar que
   existe una policy de `SELECT` para el rol `anon`/`authenticated` que permita leer **cualquier**
   fila por `slug`, sin condicionarla a `tipo`, `visible_en_home` o `inscripciones_abiertas` (esas
   tres deben seguir siendo lógica de UI, no de acceso a la fila).
2. **RLS de `inscriptions`**: idem, pero para `INSERT` — confirmar que el rol usado por el
   frontend (`anon` o `authenticated`, según si el usuario está logueado) puede insertar sin
   depender de columnas que el flujo de presentación deja en `null` (`team_name`, `steam_username`,
   `riot_id`, `qr_code`).
3. **Slugs duplicados, antes de aplicar el `UNIQUE`** (paso 1 de "Protección en Supabase"):
   `select slug, count(*) from events group by slug having count(*) > 1;` — si devuelve filas,
   resolverlas (paso 2) antes de correr el `ALTER TABLE ... UNIQUE` (paso 3).
4. **Filas con `tipo` inesperado** (por las dudas, aunque el `check` debería impedirlo):
   `select tipo, count(*) from events group by tipo;`
5. **Que la migración `20260701_add_event_tipo.sql` efectivamente se haya corrido**: confirmar que
   `events` tiene las columnas `tipo`, `visible_en_home`, `fecha_cierre_inscripcion` con los
   defaults/constraints de arriba (`\d events` en el SQL Editor, o el panel de Table Editor).
6. **Reproducir el bug mirando la consola del navegador**: con el cambio aplicado en esta revisión
   (`console.error` antes de cada `navigate('/')` en `SeleccionInscripcion.jsx`), la próxima vez
   que un usuario reporte "volví al inicio", pedirle que abra la consola (F12 → Console) *antes*
   de reintentar, o revisar la pestaña Network en el momento del fallo — la respuesta del request
   a `events?select=*&slug=eq....` va a traer el código de error real de PostgREST (por ejemplo
   `PGRST116` = "0 o más de 1 fila", o un mensaje de permission denied si es RLS).
7. **RLS de `events`/`event_games` para `DELETE` y de `inscriptions` para `SELECT`**, con el rol
   con el que queda logueado un admin — necesario para que el nuevo botón "Eliminar" de
   `EventsList.jsx` funcione (ver "Nueva dependencia de RLS" arriba). Probarlo con un admin real
   sobre un evento de prueba sin inscripciones.
8. **Aplicar la migración `20260730_events_slug_unique.sql`** siguiendo sus 3 pasos (detectar,
   inspeccionar, aplicar) — es la protección definitiva para que el incidente original no se
   repita.
9. **Confirmar `events.nombre` y `event_games.registration_mode`** con la consulta de
   `information_schema.columns` de la sección "Columnas nuevas creadas manualmente" arriba, y que
   el `CHECK` de `registration_mode` acepta exactamente `individual`, `team`, `both` (y `NULL`).
10. **RLS de `games_inscriptions` para `SELECT`**, con el rol del admin — necesario para que el
    chequeo de "¿este juego ya tiene inscripciones?" funcione tanto para editar la modalidad como
    para quitar un juego del evento. Si falla, el síntoma es que todos los selectores de modalidad
    y checkboxes de juego aparecen bloqueados con un aviso de error (fail-closed), no que se pueda
    editar/quitar de más.
11. **Probar manualmente el bloqueo de quitar un juego**: en un evento de prueba, anotar una
    inscripción a un juego puntual y confirmar que, al editar el evento, ese juego aparece tildado
    pero con el checkbox deshabilitado y el aviso correspondiente — e intentar guardar sin tocarlo
    (debería guardar bien) y con otro juego sin inscripciones destildado (también debería andar).
12. **Tipo real de `inscriptions.edad`**: confirmar con `select data_type from
    information_schema.columns where table_name = 'inscriptions' and column_name = 'edad';` que el
    cast defensivo del trigger (`::text` antes de `::integer`) no rompe nada — debería funcionar
    tanto si es `text` como si ya fuera `integer`, pero no se verificó contra la base real.
13. **Probar el trigger de edad de punta a punta**: crear un evento de prueba con `edad_maxima = 17`,
    intentar inscribirse con 18 (individual, capitán y como jugador de un equipo) y confirmar que
    Supabase rechaza el insert con el marcador `EVENT_MAXIMUM_AGE_EXCEEDED` y que la UI muestra el
    mensaje específico (no el genérico). Repetir con 17 y confirmar que sí se guarda.
14. **Probar el trigger de límite de juegos bajo carga real**: crear un evento de prueba con
    `modo_seleccion_juegos = 'libre'` y `max_juegos_por_participante = 2`, e intentar inscribirse
    (individual) seleccionando 3 juegos en un solo submit. Confirmar que el insert completo se
    rechaza con `EVENT_GAME_LIMIT_EXCEEDED` y que no queda ninguna fila parcial en
    `games_inscriptions` para esa inscripción. Ver
    `supabase/tests/20260804_event_participation_rules_manual_tests.sql` para el guion completo de
    pruebas (edad, juegos multi-fila, multi-inscripción y concurrencia con dos sesiones reales).
15. **Confirmar que el UNIQUE `games_inscriptions_inscription_game_key` quedó aplicado** tras correr
    la migración: `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid =
    'games_inscriptions'::regclass and contype = 'u';`. Si la migración abortó por duplicados
    (marcador `GAMES_INSCRIPTIONS_DUPLICATE_ROWS_FOUND`), esta consulta no va a devolver nada —
    señal de que faltó resolver los duplicados y volver a correr el archivo completo.
16. **Confirmar las 4 columnas nuevas de `events`** (`edad_minima`, `edad_maxima`,
    `modo_seleccion_juegos`, `max_juegos_por_participante`) y sus constraints con `\d events` o
    `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'events'::regclass
    and contype = 'c';` — confirmar que `modo_seleccion_juegos` quedó con el default `'clasificado'`
    para no alterar eventos existentes.
17. **Aplicar `supabase/migrations/20260824_event_game_cupos.sql`** y correr
    `supabase/tests/20260824_event_game_cupos_manual_tests.sql` en una base de prueba (nunca
    producción) — en particular la prueba 6 (concurrencia, dos sesiones reales) y las pruebas 7-9
    (RPC `register_team_inscription`, incluida la verificación de que un equipo rechazado no deja
    ningún integrante). Antes de aplicar, confirmar que no hay duplicados de `(event_id, game_id)`
    en `event_games` (la Sección 2 de la migración aborta sola si los hay, con el marcador
    `EVENT_GAMES_DUPLICATE_PAIR_ROWS_FOUND`).
18. **Confirmar que `register_team_inscription` y `get_event_game_cupos` quedaron expuestas como RPC
    para `anon`/`authenticated`**: `select routine_name, security_type from information_schema.routines
    where routine_name in ('register_team_inscription', 'get_event_game_cupos');` (debería mostrar
    `INVOKER` para la primera y `DEFINER` para la segunda) y probar ambas con
    `supabase.rpc(...)` desde una sesión anónima real (no solo desde el SQL Editor, que corre con
    privilegios de administrador y podría ocultar un problema de permisos que sí afecte a la app).
19. **Confirmar que el dueño de las funciones `SECURITY DEFINER`** (`enforce_event_game_cupo`,
    `get_event_game_cupos`) tiene privilegios de lectura sobre `event_games`/`inscriptions`/
    `games_inscriptions` — normalmente correcto si la migración se corrió con el rol admin/postgres
    por defecto del proyecto, pero no verificado desde este entorno.
20. **Correr las pruebas 16-19 nuevas** (agregadas en la auditoría de seguridad, ver
    `supabase/tests/20260824_event_game_cupos_manual_tests.sql`): 16 (UPDATE + ausencia de doble
    conteo), 17 (bypass de cupo con `game_id` no asociado al evento, individual y RPC), 18 (RPC de
    equipo contra un juego `registration_mode = 'individual'`), 19 (confirma que no sobrevive la
    firma vieja de `register_team_inscription` con `p_user_id`). Confirmar además, con un usuario
    real logueado (no la sesión del SQL Editor), que `inscriptions.user_id` queda con el UUID real
    de esa sesión al usar el RPC de equipo — no se pudo probar `auth.uid()` end-to-end desde este
    entorno (una sesión de SQL Editor no lleva JWT de usuario, `auth.uid()` da `NULL` ahí igual que
    una llamada anónima real).
21. **Pendiente explícito, fuera de alcance de esta tarea**: ni `register_team_inscription` ni el
    flujo individual (`Confirmacion.jsx`) validan `events.inscripciones_abiertas`,
    `events.fecha_cierre_inscripcion` ni si el evento ya venció — esa regla existe hoy solo en
    `SeleccionInscripcion.jsx` (frontend). Alguien con la `anon key` (pública, viaja en el bundle)
    puede insertar una inscripción para un evento cerrado llamando directo a Supabase, con o sin
    esta RPC. No es una regresión de esta migración — el flujo directo ya tenía la misma exposición
    antes. Decidir si corresponde cerrarlo con un trigger sobre `inscriptions` (afectaría a ambos
    flujos) es una decisión de producto que excede el alcance de "cupos".
22. **Antes que nada lo anterior**: correr primero la prueba 0 de
    `supabase/tests/20260824_event_game_cupos_manual_tests.sql` (introspección de
    `information_schema.columns`) para confirmar que el esquema real usa `uuid` como se documentó
    en "Tipo real de las columnas de ID" más arriba — recién después seguir con el resto de la
    lista. Si esa prueba 0 devuelve un tipo distinto de `uuid` para alguna columna de ID, **no
    seguir**: revisar de nuevo la migración contra el tipo real encontrado antes de aplicar nada
    más (mismo episodio que ya pasó una vez con `event_games.event_id`).

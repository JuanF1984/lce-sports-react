-- Cupos máximos por juego dentro de un evento (event_games.cupo_maximo) +
-- inscripción atómica de equipos (RPC register_team_inscription).
--
-- Contexto y decisiones funcionales (ver docs/games.md, docs/inscripciones.md,
-- docs/eventos.md, docs/supabase.md para el detalle completo):
--   - El cupo cuenta PERSONAS físicas, no equipos. Un equipo de 5 consume 5
--     cupos (capitán + 4 jugadores cuentan cada uno).
--   - Vive en `event_games.cupo_maximo` (la combinación evento+juego, no en
--     `games`), mismo criterio ya usado para `registration_mode`.
--   - `NULL` = sin límite (comportamiento histórico, sin cambios).
--   - `0` = cerrado para nuevas inscripciones a ese juego en ese evento.
--   - La base es la autoridad final. El frontend solo anticipa/muestra.
--
-- CÓMO CORRER ESTA MIGRACIÓN: pegar el archivo completo en el SQL Editor de
-- Supabase y ejecutarlo de una sola vez. Corre dentro de una única transacción
-- explícita (`begin;` / `commit;` más abajo): si cualquier paso falla, no
-- queda nada de este archivo aplicado.
--
-- TIPOS REALES DE ID — CORREGIDO tras un intento real de aplicar esta
-- migración contra Supabase, que falló con:
--     ERROR: 42883: operator does not exist: uuid = bigint
--     LINE ...: where eg.event_id = any(p_event_ids)
-- La primera versión de este archivo asumía `bigint identity` para todos los
-- IDs del esquema (`events.id`, `games.id`, `inscriptions.id`, etc.) — el
-- mismo supuesto, nunca confirmado, que ya venía arrastrando el resto de
-- este repo (ver docs/supabase.md y docs/games.md: no hay ninguna migración
-- versionada que cree `events`/`games`/`inscriptions`/`event_games`/
-- `games_inscriptions`, así que no hay una fuente de verdad en el código
-- para su tipo real). Esa suposición era incorrecta. Estado real, por nivel
-- de certeza:
--
--   PROBADO (error real de Postgres, no inferencia):
--     - `event_games.event_id` → `uuid`.
--
--   PROBADO con certeza muy alta (evidencia de comportamiento en producción,
--   no solo convención): `src/components/pages/VerifyAttendance.jsx:88` hace
--   `if (inscripcion.id_evento !== eventoId)` con `!==` ESTRICTO de
--   JavaScript, comparando el valor ya traído de Supabase contra `eventoId`
--   de `useParams()` de react-router — que **siempre** es `string`. Si
--   `id_evento` fuera numérico, esa comparación nunca podría dar `true` y
--   esta pantalla (verificación de asistencia por QR, ya en producción)
--   fallaría el 100% de las veces. Para que funcione como funciona hoy,
--   `id_evento` tiene que serializarse como string — consistente con
--   `uuid`, no con `bigint`/`integer`.
--     - `inscriptions.id_evento` → `uuid`.
--     - `events.id` → `uuid` (mismo tipo que su FK `inscriptions.id_evento`).
--
--   INFERIDO por consistencia de esquema (sin migración de creación
--   versionada que lo confirme, pero sin ninguna evidencia en contra):
--   se revisó TODO `src/` buscando contraevidencia (`parseInt`/`Number()`
--   sobre cualquier `id`, aritmética u ordenamiento numérico de ids) — cero
--   resultados en todo el proyecto para NINGÚN id de ninguna tabla. Nada
--   trata ningún id como número en ningún lado. Un esquema mixto (algunas
--   tablas `uuid`, otras `bigint`, dentro del mismo proyecto Supabase, sin
--   ningún motivo documentado) sería un patrón muy inusual — se asume que
--   TODO el esquema comparte la convención `uuid` (default histórico de
--   Supabase Studio para tablas creadas antes de que "Identity columns" se
--   volviera la opción por defecto — coincide con que `gallery_items`, la
--   única tabla de este repo creada por una migración real y no por el
--   Studio antiguo, sí eligió deliberadamente `bigint identity`, ver
--   `20260810_gallery_items.sql`):
--     - `games.id`, `event_games.id`, `event_games.game_id`,
--       `inscriptions.id`, `games_inscriptions.id`,
--       `games_inscriptions.id_inscription`, `games_inscriptions.id_game`
--       → `uuid`.
--
-- CÓMO SE APLICÓ LA CORRECCIÓN EN ESTE ARCHIVO: donde el tipo real no
-- importa (variables locales que solo se usan dentro de una función, sin
-- que su firma quede expuesta en un `GRANT`/`DROP FUNCTION` posterior), se
-- usa `%TYPE` contra la columna real (`inscriptions.id%TYPE`, etc.) para que
-- el código se auto-adapte al tipo real sin volver a asumir nada — EXCEPTO
-- para variables array (ver más abajo, `v_participant_ids`), donde `%TYPE`
-- no es sintácticamente válido con `[]`. Donde hace falta un tipo concreto
-- (parámetros de `register_team_inscription` y `get_event_game_cupos`,
-- porque su firma se repite textual en `GRANT EXECUTE`/`DROP FUNCTION`), se
-- usa `uuid` explícito — ya no es una suposición, es el tipo confirmado
-- arriba. No se agregó ningún cast artificial (`::text` ni similar) para
-- esconder una diferencia de tipos: donde antes había una comparación
-- `uuid = bigint` rota, ahora hay `uuid = uuid` real, sin casts de por
-- medio.
--
-- SEGUNDA CORRECCIÓN SINTÁCTICA — tras un segundo intento real de aplicar
-- esta migración, que volvió a fallar, esta vez con:
--     ERROR: 42601: syntax error at or near "["
--     LINE 453: v_participant_ids inscriptions.id%type[];
-- `%TYPE` referencia el tipo de una columna existente para que la
-- declaración se auto-adapte a ese tipo, pero PL/pgSQL NO admite agregarle
-- `[]` a continuación para declarar un array de ese tipo (a diferencia de
-- un nombre de tipo simple, donde `uuid[]` sí es válido) — la gramática de
-- `%TYPE` no acepta un sufijo de array. Se revisó el archivo completo (y
-- `supabase/tests/20260824_event_game_cupos_manual_tests.sql`) buscando
-- cualquier otra ocurrencia del patrón `%TYPE[]`/`%ROWTYPE[]`: la única es
-- la de `v_participant_ids`, corregida más abajo a `uuid[]` explícito (ya
-- no es una suposición: es el mismo tipo `uuid` de `inscriptions.id`
-- confirmado arriba, solo que ahora escrito de la única forma
-- sintácticamente válida para declarar un array). El resto de los usos de
-- `%TYPE` en este archivo (variables escalares como `v_id` en la otra
-- migración, o columnas de `RETURNS TABLE` en `get_event_game_cupos`, que
-- no llevan `[]`) no tienen este problema y quedan sin cambios.
--
-- SUPUESTOS QUE SIGUEN SIN PODER VERIFICARSE CONTRA LA BASE REAL (sin acceso
-- directo a Supabase desde este entorno, mismo aviso que el resto de las
-- migraciones de este repo):
--   1) RLS de `event_games`/`inscriptions`/`games_inscriptions`: no está
--      documentado si tienen RLS habilitado ni con qué políticas. Por eso la
--      Sección 3 (función de cupo) y la Sección 5 (RPC de lectura agregada)
--      se declaran SECURITY DEFINER — no dependen de que el rol que ejecuta
--      la operación (anon/authenticated) tenga privilegios de SELECT/UPDATE
--      sobre esas tablas; solo necesitan poder INSERTAR en `inscriptions`/
--      `games_inscriptions`, que es exactamente el mismo permiso que el
--      flujo actual (sin RPC) ya requiere y ya usa con éxito.
--   2) `inscriptions.edad` como texto: mismo supuesto defensivo que el resto
--      del proyecto (se guarda tal cual llega, sin cast) — no depende de
--      ningún tipo de ID, así que el error de `uuid`/`bigint` no lo afecta;
--      se revisó igual por pedido explícito y no se encontró nada que lo
--      contradiga (el trigger de edad ya existente, no tocado por esta
--      migración, sigue funcionando en producción con ese mismo supuesto).
--   3) Nombres de columnas usados (`event_id`, `game_id`, `id_evento`,
--      `id_inscription`, `id_game`, `id_evento`, `team_name`, etc.): sin
--      cambios respecto a la versión anterior — son los mismos nombres que
--      ya usa con éxito todo el resto del código de este repo (Confirmacion.jsx,
--      ConfirmacionEquipo.jsx, EventsList.jsx, useEventGames.jsx), y el
--      error real que motivó esta corrección fue de TIPO, no de nombre de
--      columna (Postgres encontró la columna `event_games.event_id` sin
--      problema, el error fue al comparar su tipo contra un `bigint[]`).
--   4) Nullable/not-null de las columnas de ID: no verificable sin acceso a
--      la base, pero irrelevante para esta migración — nunca se insertan
--      IDs a mano (siempre los genera el default de la columna), así que un
--      `NOT NULL` real no cambia nada de lo que este archivo hace.

begin;

-- ============================================================================
-- Sección 1: columna `event_games.cupo_maximo` + constraint de no-negativo
-- ============================================================================
-- Nullable a propósito: NULL = sin límite, comportamiento histórico intacto
-- para todo event_games existente hasta que un admin configure un cupo.

alter table event_games
    add column if not exists cupo_maximo integer;

alter table event_games
    add constraint event_games_cupo_maximo_no_negativo
        check (cupo_maximo is null or cupo_maximo >= 0);

-- ============================================================================
-- Sección 2: UNIQUE(event_id, game_id) sobre `event_games`
-- ============================================================================
-- No existía ninguna restricción que impidiera dos filas de event_games para
-- el mismo (event_id, game_id) — nada en el código la genera hoy (los
-- checkboxes de AddTournamentForm.jsx/EventsList.jsx arman `selectedGames`
-- como un array sin duplicados), pero tampoco había nada en la base que lo
-- impidiera. Hace falta ahora porque la función de la Sección 3 cuenta
-- ocupados haciendo JOIN contra `event_games` por (event_id, game_id): si
-- existiera más de una fila para el mismo par, el JOIN duplicaría el conteo
-- de `games_inscriptions` y el cupo se evaluaría mal. Mismo patrón defensivo
-- que el resto de las migraciones del proyecto: se comprueba primero si ya
-- hay duplicados reales antes de aplicar el UNIQUE, y se aborta toda la
-- transacción si los hay (no se borra/fusiona nada automáticamente).
do $$
declare
    v_grupos_duplicados integer;
    v_filas_duplicadas integer;
begin
    select count(*), coalesce(sum(cantidad), 0)
      into v_grupos_duplicados, v_filas_duplicadas
      from (
          select event_id, game_id, count(*) as cantidad
            from event_games
           group by event_id, game_id
          having count(*) > 1
      ) dup;

    if v_grupos_duplicados > 0 then
        raise exception
            'EVENT_GAMES_DUPLICATE_PAIR_ROWS_FOUND: hay % combinación(es) de (event_id, game_id) repetidas en event_games (% filas involucradas en total). No se aplicó ningún cambio de esta migración — esta transacción completa se revierte. Resolver a mano (decidir cuál fila conservar por cada combinación repetida, revisando antes si event_games_days referencia alguna de las filas duplicadas) y volver a correr este archivo. Para identificar los duplicados: select event_id, game_id, count(*) from event_games group by event_id, game_id having count(*) > 1;',
            v_grupos_duplicados, v_filas_duplicadas
            using errcode = 'LCE08';
    end if;
end;
$$;

alter table event_games
    add constraint event_games_event_id_game_id_key
        unique (event_id, game_id);

-- ============================================================================
-- Sección 3: validación definitiva de cupo — trigger de SENTENCIA (no de
-- fila) sobre `games_inscriptions`, con tabla de transición
-- ============================================================================
--
-- Mismo diseño que `enforce_event_game_limit()` en
-- 20260804_event_participation_rules.sql (tabla de transición
-- `REFERENCING NEW TABLE`, dos triggers separados para INSERT/UPDATE porque
-- Postgres no permite combinarlos en uno solo con tabla de transición), con
-- una diferencia deliberada:
--
--   El recurso que hay que bloquear ANTES de contar no es una fila de
--   `inscriptions` (como en el trigger de máximo de juegos, que protege "esta
--   inscripción no tenga más juegos de los que le corresponden") sino la fila
--   de `event_games` correspondiente al par (evento, juego) — el recurso real
--   que se está agotando es "cupos de ESTE juego en ESTE evento", compartido
--   entre TODAS las inscripciones que elijan ese juego en ese evento, no uno
--   por inscripción.
--
-- Diseño:
--   1. `inserted_games` (tabla de transición) trae las filas nuevas de
--      `games_inscriptions` de la sentencia completa (INSERT o UPDATE, sea
--      multi-fila o no).
--   2. Se identifican los pares (event_id, game_id) afectados, resolviendo
--      event_id vía `inscriptions.id_evento` (games_inscriptions no tiene
--      event_id directo).
--   3. Se bloquea, en orden determinístico (`order by event_id, game_id`),
--      la fila de `event_games` de cada par afectado, ANTES de contar nada —
--      serializa altas concurrentes al mismo evento+juego y evita deadlocks
--      entre sentencias que bloqueen el mismo conjunto de pares en órdenes
--      distintos. Si ALGÚN par no tiene fila en `event_games` (el juego no
--      está asociado a ese evento — no debería poder pasar desde la app,
--      pero SÍ puede pasar si alguien llama a Supabase directo con un
--      `id_game` que no corresponde al evento, precisamente para esquivar un
--      cupo que sí está configurado para el par real), se rechaza toda la
--      sentencia con `EVENT_GAME_NOT_CONFIGURED` (errcode LCE10) — un juego
--      sin fila en `event_games` no tiene ningún cupo que hacer cumplir, así
--      que dejarlo pasar en silencio sería un bypass trivial de todo este
--      mecanismo (auditoría de seguridad, ver docs/inscripciones.md). Esto
--      protege por igual al flujo individual (`Confirmacion.jsx`) y al de
--      equipo (`register_team_inscription`, Sección 4 — que además hace la
--      misma verificación por adelantado, antes de insertar nada, para dar
--      un error más rápido y específico).
--   4. Con los locks tomados, cuenta el total DEFINITIVO de personas
--      inscriptas (filas de `games_inscriptions` unidas a `inscriptions` de
--      ESE evento) por cada par tocado cuyo `event_games.cupo_maximo` no sea
--      NULL, y compara contra ese máximo.
--   5. Si algún par quedó con más personas que su cupo, lanza
--      `EVENT_GAME_CUPO_EXCEEDED` (errcode LCE06) y Postgres revierte la
--      sentencia COMPLETA (estándar AFTER STATEMENT) — no quedan filas
--      parciales de ningún participante, tampoco de otros pares que por sí
--      solos hubieran estado dentro del límite.
--
-- SECURITY DEFINER (a diferencia de `enforce_event_game_limit()`, que no lo
-- usa): esta función necesita `select ... for update` sobre `event_games`,
-- una tabla de configuración administrada por el panel admin. No queremos
-- otorgarle a `anon`/`authenticated` el privilegio real de UPDATE sobre
-- `event_games` (habilitaría alterar cupos/modalidad de cualquier evento
-- desde el cliente) solo para que el lock funcione — Postgres exige el
-- privilegio de UPDATE en la tabla para poder usar `FOR UPDATE`, incluso
-- aunque la fila nunca se escriba de verdad. Declarando la función SECURITY
-- DEFINER (dueño = quien corre esta migración, típicamente el rol con el que
-- se conecta el SQL Editor), el lock y el conteo corren con privilegios
-- elevados sin que el rol que dispara el INSERT necesite ningún permiso
-- nuevo sobre `event_games`. `search_path` fijo por higiene estándar de
-- funciones SECURITY DEFINER (evita que un search_path manipulado resuelva
-- nombres de tabla a un esquema distinto).

create or replace function enforce_event_game_cupo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_pair record;
    v_violation record;
begin
    -- Bloquea, en orden determinístico, todas las filas de event_games que
    -- correspondan a los pares (evento, juego) tocados por esta sentencia.
    for v_pair in
        select distinct i.id_evento as event_id, ig.id_game as game_id
          from inserted_games ig
          join inscriptions i on i.id = ig.id_inscription
         order by i.id_evento, ig.id_game
    loop
        perform 1
          from event_games
         where event_id = v_pair.event_id
           and game_id = v_pair.game_id
         for update;

        -- Ver el punto 3 del diseño más arriba: sin fila en event_games no
        -- hay cupo que hacer cumplir para este par — rechazar en vez de
        -- dejarlo pasar en silencio (sería un bypass del cupo real).
        if not found then
            raise exception 'EVENT_GAME_NOT_CONFIGURED'
                using errcode = 'LCE10',
                      detail = format(
                          'El juego %s no está asociado al evento %s (no existe fila en event_games).',
                          v_pair.game_id, v_pair.event_id
                      );
        end if;
    end loop;

    -- Estado definitivo DESPUÉS de la sentencia completa: para cada par
    -- (evento, juego) tocado cuyo cupo esté configurado, cuenta el total real
    -- de PERSONAS inscriptas (filas de games_inscriptions de esa combinación,
    -- unidas a inscriptions del mismo evento — nunca cuenta otros eventos) y
    -- compara contra el cupo. Alcanza con una sola infracción para rechazar
    -- toda la sentencia.
    select eg.event_id, eg.game_id, eg.cupo_maximo as v_max, count(*) as v_cantidad
      into v_violation
      from event_games eg
      join inscriptions i on i.id_evento = eg.event_id
      join games_inscriptions gi on gi.id_inscription = i.id and gi.id_game = eg.game_id
     where (eg.event_id, eg.game_id) in (
               select distinct i2.id_evento, ig2.id_game
                 from inserted_games ig2
                 join inscriptions i2 on i2.id = ig2.id_inscription
           )
       and eg.cupo_maximo is not null
     group by eg.event_id, eg.game_id, eg.cupo_maximo
    having count(*) > eg.cupo_maximo
     limit 1;

    if found then
        raise exception 'EVENT_GAME_CUPO_EXCEEDED'
            using errcode = 'LCE06',
                  detail = format(
                      'El evento %s / juego %s quedó con más personas inscriptas (%s) que el cupo máximo configurado (%s).',
                      v_violation.event_id, v_violation.game_id, v_violation.v_cantidad, v_violation.v_max
                  );
    end if;

    return null; -- ignorado en triggers AFTER STATEMENT
end;
$$;

drop trigger if exists trg_enforce_event_game_cupo_insert on games_inscriptions;
create trigger trg_enforce_event_game_cupo_insert
    after insert on games_inscriptions
    referencing new table as inserted_games
    for each statement
    execute function enforce_event_game_cupo();

drop trigger if exists trg_enforce_event_game_cupo_update on games_inscriptions;
create trigger trg_enforce_event_game_cupo_update
    after update on games_inscriptions
    referencing new table as inserted_games
    for each statement
    execute function enforce_event_game_cupo();

-- ============================================================================
-- Sección 4: RPC `register_team_inscription` — inscripción atómica de equipo
-- ============================================================================
--
-- Reemplaza, del lado de la base, la secuencia de inserts sueltos que hace
-- hoy ConfirmacionEquipo.jsx (un INSERT por integrante, cada uno su propia
-- request/transacción implícita). Ese patrón podía dejar un equipo a medio
-- registrar si el cupo se agotaba a mitad de camino (ej.: quedan 3 cupos,
-- se anota un equipo de 5 → capitán + 2 jugadores quedan guardados, el 4to
-- falla). Esta función corre TODO el alta del equipo (capitán + jugadores +
-- games_inscriptions) dentro de una única llamada — y por lo tanto una única
-- transacción implícita de PostgreSQL: cualquier excepción no capturada
-- (la del trigger de edad `trg_validate_participant_age`, la del trigger de
-- cupo de la Sección 3, o cualquier otro error de INSERT) revierte TODO lo
-- que la función haya hecho hasta ese punto — no queda ningún integrante
-- guardado.
--
-- Validación de reglas: a propósito esta función NO reimplementa validación
-- de edad ni de cupo — las reutiliza tal cual disparándolas naturalmente:
--   - Cada INSERT en `inscriptions` dispara `trg_validate_participant_age`
--     (BEFORE INSERT FOR EACH ROW, ya existente) exactamente igual que si el
--     insert viniera del frontend directo.
--   - El INSERT multi-fila final en `games_inscriptions` (capitán + todos
--     los jugadores en una sola sentencia) dispara
--     `trg_enforce_event_game_cupo_insert` (Sección 3) UNA sola vez, que
--     evalúa el resultado definitivo de esa sentencia — así el cupo del
--     equipo completo se valida de forma atómica, no jugador por jugador.
-- Esto evita duplicar en dos lugares (RPC y trigger) la misma regla de
-- negocio — un solo lugar sigue siendo la autoridad de cada regla.
--
-- SECURITY INVOKER (default, sin declarar SECURITY DEFINER): a diferencia de
-- la función de la Sección 3, esta función SÍ escribe filas reales con datos
-- personales (`inscriptions`) — tiene que correr con los mismos privilegios
-- que ya tiene el rol que llama (anon/authenticated), ni más ni menos, para
-- no otorgar ninguna capacidad de escritura que ese rol no tuviera ya con el
-- flujo actual de inserts directos. Los triggers que se disparan por dentro
-- (edad, cupo) sí son SECURITY DEFINER cuando lo necesitan (cupo), así que la
-- validación funciona sin importar el RLS de `event_games`, sin que la RPC
-- en sí necesite privilegios elevados.
--
-- SEGURIDAD — `auth.uid()` en vez de un parámetro `p_user_id` (corregido en
-- auditoría posterior a la primera versión de esta migración, antes de
-- aplicarla): la primera versión recibía `p_user_id uuid` directo del
-- cliente y lo insertaba tal cual en `inscriptions.user_id` — mismo patrón
-- que ya usaba `ConfirmacionEquipo.jsx` (`user_id: user.id` sacado del
-- estado de React). Cualquier persona que llame al RPC directo desde el
-- navegador (ver el resto de este comentario, "posibilidad de ejecutar
-- funciones directamente desde el navegador") puede mandar CUALQUIER UUID en
-- ese parámetro — nada lo ataba a la sesión real. Esto permitía asociar una
-- inscripción a la cuenta de otra persona (suplantación) sin necesitar su
-- contraseña ni su sesión, solo conociendo o adivinando su `id` de usuario
-- (que no es secreto: aparece en cualquier tabla que un admin exporte, en
-- URLs, etc.). Se confirmó (ver `src/utils/supabase.js` +
-- `src/context/AuthProvider.jsx`) que el proyecto usa el cliente estándar de
-- `@supabase/supabase-js` con sesión persistida (`supabase.auth.getSession()`
-- / `onAuthStateChange`) — es decir, un JWT real de Supabase Auth viaja en
-- cada request, y `auth.uid()` lee el `sub` de ESE JWT del lado del
-- servidor, fuera del alcance de lo que el cliente puede falsificar. Esta
-- función, al ser SECURITY INVOKER, ejecuta `auth.uid()` en el contexto de
-- la sesión real de quien la llamó — mismo mecanismo que ya usaría cualquier
-- policy RLS `with check (user_id = auth.uid())`. Devuelve `NULL` para una
-- sesión anónima, igual semántica que el `user?.id ?? null` que ya usaba el
-- frontend — comportamiento observable sin cambios para un uso legítimo,
-- solo deja de ser falsificable.
--
-- `p_players` es un array JSON (posiblemente vacío) con los jugadores
-- adicionales del equipo (todo excepto el capitán). El capitán viaje aparte
-- en `p_captain` porque lleva campos que los jugadores no llevan
-- (`team_name`, `steam_username`, `riot_id`, `localidad` propia) — mismo
-- criterio que ya usa ConfirmacionEquipo.jsx hoy.
--
-- SEGURIDAD — validación de (evento, juego) antes de insertar nada: la
-- primera versión de esta función no verificaba que `p_game_id` estuviera
-- realmente asociado a `p_event_id` vía `event_games`. Alguien llamando al
-- RPC directo podía mandar un `p_game_id` de OTRO evento (o de ningún
-- evento) que no tuviera cupo configurado — el trigger de cupo de la
-- Sección 3 nunca se activa para un par sin fila en `event_games` (antes de
-- esta auditoría, ni siquiera lo rechazaba), así que era una forma directa
-- de esquivar el cupo real del juego que sí correspondía. Se agrega acá el
-- mismo chequeo que ahora también hace el trigger (Sección 3, defensa en
-- profundidad — éste lo hace antes de insertar nada, para fallar rápido y
-- con un mensaje específico de equipo) más la verificación de
-- `registration_mode`: un juego con modalidad `'individual'` en ESE evento
-- no admite equipos, y nada lo impedía antes de esta corrección (ninguna
-- validación de modalidad existe hoy del lado de la base para ningún flujo —
-- solo en el frontend, `SeleccionInscripcion.jsx` — pero un RPC cuyo único
-- propósito es crear un equipo es el lugar exacto donde sí corresponde
-- cerrar esto, sin tocar nada del flujo individual). El fallback de
-- `registration_mode = NULL` replica exactamente `getEffectiveRegistrationMode`
-- (`src/utils/registrationMode.js`): `NULL` se trata como `team_option ?
-- 'both' : 'individual'`.
--
-- No genera `qr_code`: esa lógica vive en el cliente (`generateQRString`,
-- src/utils/qrCodeGenerator.js) y se aplica con un UPDATE puntual por fila
-- DESPUÉS de esta llamada, exactamente igual que ya hace hoy el flujo
-- individual (`Confirmacion.jsx`) y el de equipo — no es parte de la
-- atomicidad que hay que garantizar (perder el QR de una inscripción ya
-- guardada es recuperable con un update; perder el cupo del equipo no lo
-- es), así que no se duplicó esa lógica en SQL.

-- Defensivo: si una versión anterior de esta función (con el parámetro
-- `p_user_id uuid` que esta auditoría eliminó — ver el comentario de
-- seguridad de arriba, Y con `p_event_id`/`p_game_id bigint`, el tipo
-- incorrecto que esta corrección reemplaza por `uuid`) llegó a aplicarse
-- contra alguna base de prueba antes de esta corrección, `create or replace
-- function` con una lista de parámetros distinta NO la reemplaza — Postgres
-- las trata como dos funciones sobrecargadas distintas, y la versión vieja
-- (vulnerable a suplantación de usuario, además de tener el tipo de ID
-- roto) quedaría igual de expuesta. Este DROP se asegura de que no
-- sobreviva ninguna versión con esa firma vieja.
drop function if exists register_team_inscription(bigint, bigint, jsonb, jsonb, uuid);

create or replace function register_team_inscription(
    p_event_id uuid,
    p_game_id uuid,
    p_captain jsonb,
    p_players jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_event_game record;
    v_effective_mode text;
    v_captain_row inscriptions;
    v_player_row inscriptions;
    v_player jsonb;
    v_players_result jsonb := '[]'::jsonb;
    -- `uuid[]` explícito, NO `inscriptions.id%type[]`: `%TYPE` no admite un
    -- sufijo de array en PL/pgSQL (ver la corrección al principio del
    -- archivo, "SEGUNDA CORRECCIÓN SINTÁCTICA" — esa combinación es lo que
    -- rompía la migración con "syntax error at or near '['"). Es el mismo
    -- tipo real de inscriptions.id (uuid, confirmado arriba), solo que
    -- escrito de la única forma válida para declarar un array de ese tipo.
    v_participant_ids uuid[];
begin
    if p_captain is null then
        raise exception 'INVALID_TEAM_PAYLOAD'
            using errcode = 'LCE09',
                  detail = 'Falta la información del capitán del equipo.';
    end if;

    -- (Evento, juego) tiene que existir como asociación real, con la misma
    -- fila que el trigger de cupo va a usar para contar — evita el bypass de
    -- cupo descripto arriba, y de paso valida implícitamente que p_event_id
    -- y p_game_id correspondan entre sí (un p_event_id inexistente nunca va
    -- a tener fila en event_games, así que también queda cubierto).
    select eg.registration_mode, g.team_option
      into v_event_game
      from event_games eg
      join games g on g.id = eg.game_id
     where eg.event_id = p_event_id
       and eg.game_id = p_game_id;

    if not found then
        raise exception 'EVENT_GAME_NOT_CONFIGURED'
            using errcode = 'LCE10',
                  detail = format(
                      'El juego %s no está asociado al evento %s.',
                      p_game_id, p_event_id
                  );
    end if;

    -- Mismo fallback que getEffectiveRegistrationMode (src/utils/registrationMode.js):
    -- NULL histórico se comporta como 'both' si el juego admite equipo, o
    -- 'individual' si no.
    v_effective_mode := coalesce(
        v_event_game.registration_mode,
        case when v_event_game.team_option then 'both' else 'individual' end
    );

    if v_effective_mode = 'individual' then
        raise exception 'TEAM_NOT_ALLOWED_FOR_GAME'
            using errcode = 'LCE11',
                  detail = format(
                      'El juego %s no admite inscripción de equipos en el evento %s (registration_mode efectivo: individual).',
                      p_game_id, p_event_id
                  );
    end if;

    -- 1) Capitán. user_id sale de auth.uid() (ver el comentario de seguridad
    -- de más arriba), nunca de un parámetro del cliente.
    insert into inscriptions (
        user_id, nombre, apellido, edad, email, celular, localidad,
        id_evento, team_name, steam_username, riot_id
    )
    values (
        v_user_id,
        p_captain ->> 'nombre',
        p_captain ->> 'apellido',
        nullif(p_captain ->> 'edad', ''),
        nullif(p_captain ->> 'email', ''),
        p_captain ->> 'celular',
        p_captain ->> 'localidad',
        p_event_id,
        p_captain ->> 'team_name',
        nullif(p_captain ->> 'steam_username', ''),
        nullif(p_captain ->> 'riot_id', '')
    )
    returning * into v_captain_row;

    v_participant_ids := array[v_captain_row.id];

    -- 2) Jugadores adicionales, uno por uno (mismo orden que
    --    ConfirmacionEquipo.jsx), todos dentro de la MISMA transacción que el
    --    capitán. localidad/team_name se toman del capitán, igual que hoy.
    for v_player in select * from jsonb_array_elements(coalesce(p_players, '[]'::jsonb))
    loop
        insert into inscriptions (
            user_id, nombre, apellido, edad, email, celular, localidad,
            id_evento, team_name
        )
        values (
            v_user_id,
            v_player ->> 'nombre',
            v_player ->> 'apellido',
            nullif(v_player ->> 'edad', ''),
            nullif(v_player ->> 'email', ''),
            v_player ->> 'celular',
            p_captain ->> 'localidad',
            p_event_id,
            p_captain ->> 'team_name'
        )
        returning * into v_player_row;

        v_players_result := v_players_result || to_jsonb(v_player_row);
        v_participant_ids := v_participant_ids || v_player_row.id;
    end loop;

    -- 3) games_inscriptions: UN solo INSERT multi-fila para capitán + todos
    --    los jugadores -> dispara trg_enforce_event_game_cupo_insert UNA vez,
    --    evaluando el equipo completo contra el cupo disponible. Si falla,
    --    toda la función aborta y Postgres revierte también los inserts de
    --    `inscriptions` de los pasos 1 y 2 — no queda ningún integrante.
    insert into games_inscriptions (id_inscription, id_game)
    select unnest(v_participant_ids), p_game_id;

    return jsonb_build_object(
        'captain', to_jsonb(v_captain_row),
        'players', v_players_result
    );
end;
$$;

-- PostgREST expone esta función como RPC (`supabase.rpc('register_team_inscription', ...)`)
-- solo a los roles con EXECUTE explícito. Se otorga a `anon` y `authenticated`
-- porque el flujo de inscripción hoy acepta ambos casos (usuario logueado o
-- no) — mismo alcance que ya tienen hoy para insertar directo en
-- `inscriptions`/`games_inscriptions`, ningún permiso nuevo de más.
grant execute on function register_team_inscription(uuid, uuid, jsonb, jsonb)
    to anon, authenticated;

-- ============================================================================
-- Sección 5: RPC de lectura `get_event_game_cupos` — cupo/ocupados/disponibles
-- ============================================================================
--
-- Evita que el frontend tenga que hacer un count() por cada (evento, juego)
-- desde el cliente (N requests) para poder mostrar "18/30"/"Quedan N" en
-- SeleccionJuego.jsx y en el admin. Recibe un array de event_id (mismo patrón
-- que ya usa useEventGames(eventIds) con `.in('event_id', eventIds)`) y
-- devuelve, por cada (event_id, game_id) de event_games que tenga fila, el
-- cupo configurado y el conteo real de personas inscriptas.
--
-- SECURITY DEFINER, deliberado: esta función necesita leer `inscriptions`
-- (para contar) sin depender de que `anon` tenga SELECT sobre esa tabla via
-- RLS (no está confirmado, ver aviso al principio del archivo) — pero SOLO
-- devuelve números agregados (cupo_maximo/ocupados/disponibles por
-- evento+juego), nunca una fila de `inscriptions` ni ningún dato personal.
-- No hay forma de que este RPC filtre información sensible sin importar qué
-- privilegios tenga quien lo llama.
--
-- `stable` (no `volatile`): es una consulta de solo lectura, ayuda al
-- planner; no tiene ningún efecto colateral.

-- `p_event_ids uuid`: tipo concreto (no `%type`) porque esta firma se repite
-- textual en el `grant execute` de más abajo — ver el aviso de tipos al
-- principio del archivo. Las columnas de `returns table` SÍ usan `%type`
-- contra las columnas reales de `event_games` (el `grant`/`drop function` no
-- necesitan conocer el tipo de retorno, solo el de los parámetros), para que
-- ni siquiera esta parte dependa de haber adivinado bien el tipo real.
create or replace function get_event_game_cupos(p_event_ids uuid[])
returns table (
    event_id event_games.event_id%type,
    game_id event_games.game_id%type,
    cupo_maximo event_games.cupo_maximo%type,
    ocupados bigint,
    disponibles integer
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
    select
        eg.event_id,
        eg.game_id,
        eg.cupo_maximo,
        count(gi.id) as ocupados,
        case
            when eg.cupo_maximo is null then null
            else greatest(eg.cupo_maximo - count(gi.id)::integer, 0)
        end as disponibles
      from event_games eg
      left join inscriptions i on i.id_evento = eg.event_id
      left join games_inscriptions gi on gi.id_inscription = i.id and gi.id_game = eg.game_id
     where eg.event_id = any(p_event_ids)
     group by eg.event_id, eg.game_id, eg.cupo_maximo;
$$;

grant execute on function get_event_game_cupos(uuid[]) to anon, authenticated;

commit;

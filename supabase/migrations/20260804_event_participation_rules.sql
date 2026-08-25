-- Reglas configurables por evento: límite de edad (mín/máx) y modo de selección
-- de juegos ('clasificado' = principal/secundario actual, 'libre' = todos los
-- juegos por igual, con tope opcional de cantidad por participante).
--
-- Pensado para el primer torneo que lo necesita (menores de 18, inscripción
-- libre a todos los juegos) sin acoplar la regla a su id/slug/nombre: todo se
-- resuelve leyendo estas columnas de `events`, así que cualquier evento futuro
-- puede activarlas o no. Ver docs/eventos.md, docs/inscripciones.md y
-- docs/supabase.md para el detalle completo de semántica.
--
-- CÓMO CORRER ESTA MIGRACIÓN: pegar el archivo completo en el SQL Editor de
-- Supabase y ejecutarlo de una sola vez, de arriba hacia abajo. Todo el
-- archivo corre dentro de una única transacción explícita (`begin;` / `commit;`
-- más abajo): si cualquier paso falla — en particular, el chequeo de
-- duplicados de la Sección 4 — no queda NINGÚN cambio de este archivo
-- aplicado (ni las columnas nuevas de `events`, ni los triggers de edad/
-- límite de juegos, ni el UNIQUE). No hace falta correr secciones por
-- separado ni revisar a mano el resultado de ningún SELECT antes de seguir:
-- la Sección 4 aborta sola, con un mensaje explícito, si encuentra
-- duplicados en `games_inscriptions` — a diferencia de
-- `supabase/migrations/20260730_events_slug_unique.sql`, que sí sigue ese
-- patrón manual de "correr un SELECT y decidir a mano" (esa migración no se
-- tocó acá).
--
-- Si la Sección 4 aborta por duplicados: no se pierde nada (rollback
-- automático de toda la transacción), hay que resolver los duplicados a mano
-- (ver esa sección) y volver a correr el archivo completo.
--
-- Compatibilidad: todas las columnas son nullable o tienen default que replica
-- el comportamiento histórico. Ningún evento existente cambia de comportamiento
-- hasta que un admin configure explícitamente estos campos.
--
-- Pruebas manuales (SQL reproducible, edad + juegos + concurrencia): ver
-- supabase/tests/20260804_event_participation_rules_manual_tests.sql. Ese
-- archivo NO forma parte de esta migración y no se ejecuta automáticamente.

begin;

-- ============================================================================
-- Sección 1: columnas nuevas en `events` + constraints de validación
-- ============================================================================

alter table events
    add column if not exists edad_minima integer,
    add column if not exists edad_maxima integer,
    add column if not exists modo_seleccion_juegos text not null default 'clasificado',
    add column if not exists max_juegos_por_participante integer;

alter table events
    add constraint events_edad_minima_no_negativa
        check (edad_minima is null or edad_minima >= 0),
    add constraint events_edad_maxima_no_negativa
        check (edad_maxima is null or edad_maxima >= 0),
    add constraint events_edad_rango_valido
        check (edad_minima is null or edad_maxima is null or edad_minima <= edad_maxima),
    add constraint events_max_juegos_valido
        check (max_juegos_por_participante is null or max_juegos_por_participante >= 1),
    add constraint events_modo_seleccion_juegos_valido
        check (modo_seleccion_juegos in ('clasificado', 'libre'));

-- ============================================================================
-- Sección 2: validación definitiva de edad — trigger sobre `inscriptions`
-- ============================================================================
--
-- Sin cambios de diseño respecto a la versión anterior de esta migración.
-- Cubre los tres casos reales de persistencia (verificados en el código antes
-- de escribir esto, ver Confirmacion.jsx / ConfirmacionEquipo.jsx):
--   - Inscripción individual  -> 1 fila en `inscriptions` (Confirmacion.jsx)
--   - Capitán de un equipo    -> 1 fila en `inscriptions` (ConfirmacionEquipo.jsx, paso 1)
--   - Cada jugador del equipo -> 1 fila en `inscriptions` por jugador (paso 2, insert secuencial)
-- Es decir: TODOS los participantes (individual, capitán, cada jugador) pasan
-- por un INSERT propio en `inscriptions`, uno a la vez. Un solo trigger
-- BEFORE INSERT FOR EACH ROW sobre `inscriptions` alcanza para cubrir los tres
-- casos — a diferencia de `games_inscriptions` (Sección 3), acá no hay
-- inserts multi-fila que resolver, cada participante es su propia sentencia.
--
-- `inscriptions.edad` se trata como texto (así la envía el frontend, sin
-- parsear) pero el cast es defensivo: funciona igual si la columna ya fuera
-- integer. Esto no se pudo confirmar contra la base real (sin acceso directo
-- a Supabase desde este entorno) — verificar el tipo real antes de dar por
-- buena esta suposición (ver docs/supabase.md).

create or replace function validate_participant_age()
returns trigger
language plpgsql
as $$
declare
    v_edad_minima integer;
    v_edad_maxima integer;
    v_edad_int integer;
begin
    select edad_minima, edad_maxima
      into v_edad_minima, v_edad_maxima
      from events
     where id = new.id_evento;

    -- Evento sin límites configurados (o no encontrado): comportamiento
    -- histórico intacto, no se aplica ninguna regla nueva.
    if v_edad_minima is null and v_edad_maxima is null then
        return new;
    end if;

    if new.edad is null or btrim(new.edad::text) = '' then
        raise exception 'INVALID_PARTICIPANT_AGE'
            using errcode = 'LCE01',
                  detail = 'La inscripción no incluye una edad y el evento tiene límite de edad configurado.';
    end if;

    begin
        v_edad_int := btrim(new.edad::text)::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'INVALID_PARTICIPANT_AGE'
            using errcode = 'LCE01',
                  detail = format('El valor de edad "%s" no es un número entero válido.', new.edad);
    end;

    if v_edad_int < 0 then
        raise exception 'INVALID_PARTICIPANT_AGE'
            using errcode = 'LCE01',
                  detail = 'La edad no puede ser negativa.';
    end if;

    if v_edad_minima is not null and v_edad_int < v_edad_minima then
        raise exception 'EVENT_MINIMUM_AGE_NOT_MET'
            using errcode = 'LCE02',
                  detail = format('Edad mínima requerida: %s. Edad recibida: %s.', v_edad_minima, v_edad_int);
    end if;

    if v_edad_maxima is not null and v_edad_int > v_edad_maxima then
        raise exception 'EVENT_MAXIMUM_AGE_EXCEEDED'
            using errcode = 'LCE03',
                  detail = format('Edad máxima permitida: %s. Edad recibida: %s.', v_edad_maxima, v_edad_int);
    end if;

    return new;
end;
$$;

drop trigger if exists trg_validate_participant_age on inscriptions;
create trigger trg_validate_participant_age
    before insert on inscriptions
    for each row
    execute function validate_participant_age();

-- ============================================================================
-- Sección 3: validación definitiva del máximo de juegos — trigger de
-- SENTENCIA (no de fila) sobre `games_inscriptions`, con tabla de transición
-- ============================================================================
--
-- Rediseño respecto a la primera versión de esta migración. La versión
-- anterior usaba `BEFORE INSERT FOR EACH ROW` y confiaba en que, dentro de un
-- mismo INSERT multi-fila (el caso real de la inscripción individual, ver
-- Confirmacion.jsx: todos los juegos elegidos se insertan en un solo
-- `.insert(gameRows)`), un SELECT en el trigger de una fila pudiera ver las
-- filas hermanas ya procesadas del mismo comando. Ese comportamiento nunca se
-- verificó contra una instancia real y, aunque Postgres sí expone las filas
-- previas del mismo INSERT a un trigger BEFORE ROW posterior via el contador
-- de comando, un diseño FOR EACH ROW es frágil para esto por construcción:
-- depende de un detalle interno de ejecución fila por fila, no de una
-- garantía explícita sobre el resultado final de la sentencia. Se reemplaza
-- por un trigger de sentencia (`FOR EACH STATEMENT`) con tabla de transición
-- (`REFERENCING NEW TABLE`, disponible desde Postgres 10 — Supabase corre una
-- versión muy superior a esa), que evalúa el estado DEFINITIVO después de
-- ejecutarse toda la sentencia, sin importar cuántas filas insertó ni a
-- cuántas inscripciones distintas tocó.
--
-- Diseño:
--   1. `inserted_games` es la tabla de transición: contiene TODAS las filas
--      nuevas de la sentencia que disparó el trigger (todas las del INSERT,
--      o todas las filas resultantes de un UPDATE), sin importar si vinieron
--      en un solo `.insert(...)` con un array o en llamadas separadas dentro
--      de la misma sentencia SQL.
--   2. Se identifican las inscripciones afectadas con
--      `select distinct id_inscription from inserted_games`.
--   3. Cada una de esas inscripciones se bloquea (`select ... for update`)
--      ANTES de contar, una por una y en orden determinístico
--      (`order by id_inscription`), para serializar sentencias concurrentes
--      que tocan la misma inscripción y evitar deadlocks entre dos
--      transacciones que bloquean varias filas en órdenes distintos (si dos
--      sentencias tocan el mismo conjunto de inscripciones pero listadas en
--      orden distinto, bloquear siempre en el mismo orden ascendente
--      garantiza que nunca se forme un ciclo de espera).
--   4. Recién con los locks tomados, se cuenta el total DEFINITIVO de
--      `games_inscriptions` por inscripción (después del INSERT/UPDATE actual,
--      incluyendo filas de otras transacciones ya committeadas) y se compara
--      contra `events.max_juegos_por_participante`.
--   5. La regla solo se evalúa cuando `modo_seleccion_juegos = 'libre'` y
--      `max_juegos_por_participante is not null` — el JOIN con `events` filtra
--      todo lo demás (modo 'clasificado', o 'libre' sin máximo) antes de
--      llegar al `having`, así que esas inscripciones nunca entran en el
--      cálculo y jamás pueden hacer fallar la sentencia.
--   6. Si CUALQUIER inscripción tocada por la sentencia supera su máximo, se
--      lanza `EVENT_GAME_LIMIT_EXCEEDED` y Postgres hace rollback de la
--      sentencia COMPLETA (estándar de un trigger AFTER STATEMENT: si falla,
--      revierte todo lo que esa sentencia había hecho, incluida la tabla de
--      transición) — no quedan filas parciales de ningún participante ni de
--      ninguna inscripción del lote, aunque solo una de varias haya excedido
--      el máximo.
--   7. Cubre tanto un INSERT (alta de juegos nuevos) como un UPDATE que
--      reasigne `id_inscription` o `id_game` de una fila existente. En ambos
--      casos `inserted_games` contiene las filas con sus valores NUEVOS —
--      para un UPDATE, eso significa la inscripción de DESTINO (adonde quedó
--      la relación después del cambio), no la de origen. Como el primer paso
--      del diseño identifica las inscripciones afectadas leyendo
--      exclusivamente `inserted_games`, un UPDATE que mueva una relación
--      hacia una inscripción que ya está en (o queda en) su máximo se
--      rechaza igual — la inscripción de destino queda incluida en el
--      cálculo automáticamente, sin lógica aparte para distinguir "de dónde
--      vino" la fila. Hoy el código de la app nunca hace UPDATE sobre
--      `games_inscriptions` (solo INSERT, ver Confirmacion.jsx /
--      ConfirmacionEquipo.jsx) — se cubre de todas formas para que la
--      protección sea real contra cualquier UPDATE directo, no solo contra
--      el INSERT que usa hoy el frontend.
--
-- IMPORTANTE — dos triggers, no uno combinado: Postgres NO permite un único
-- trigger declarado como `AFTER INSERT OR UPDATE ... REFERENCING NEW TABLE`.
-- Cuando un trigger lista más de un tipo de evento, no puede tener tabla de
-- transición — hay que declarar un trigger separado por cada evento que la
-- necesite (restricción documentada de `CREATE TRIGGER`). Por eso la función
-- `enforce_event_game_limit()` de abajo se reutiliza desde DOS triggers
-- independientes, `trg_enforce_event_game_limit_insert` (AFTER INSERT) y
-- `trg_enforce_event_game_limit_update` (AFTER UPDATE), cada uno con su
-- propio `REFERENCING NEW TABLE AS inserted_games` — la función no necesita
-- saber cuál de los dos la invocó porque solo lee `inserted_games`, nunca
-- `TG_OP`.
-- Concurrencia: dos sesiones agregando juegos a la MISMA inscripción al mismo
-- tiempo. La sesión que llega primero a `select ... for update` toma el lock
-- de esa fila de `inscriptions` y lo retiene hasta el commit/rollback de su
-- transacción. La segunda sesión queda bloqueada en ese mismo `select ... for
-- update` hasta que la primera termine. Cuando por fin lo obtiene, su propio
-- `count(*)` ve tanto las filas ya committeadas de la primera transacción como
-- las suyas propias (siempre visibles dentro de la misma transacción por
-- MVCC), así que el total que evalúa es el real combinado de ambas — no el
-- que vería cada sesión mirando solo su propio INSERT de forma aislada. Esto
-- SÍ requiere probarse con dos sesiones reales (ver el archivo de pruebas
-- manuales) — no alcanza con este análisis estático.

create or replace function enforce_event_game_limit()
returns trigger
language plpgsql
as $$
declare
    v_id inscriptions.id%type;
    v_violation record;
begin
    -- Bloquea, en orden determinístico, todas las inscripciones tocadas por
    -- esta sentencia (INSERT o UPDATE) antes de contar nada.
    for v_id in
        select distinct id_inscription
          from inserted_games
         order by id_inscription
    loop
        perform 1 from inscriptions where id = v_id for update;
    end loop;

    -- Estado definitivo DESPUÉS de la sentencia completa (no fila por fila):
    -- para cada inscripción tocada cuyo evento esté en modo 'libre' y tenga
    -- un máximo configurado, cuenta el total real de juegos que le quedaron
    -- asociados y compara contra ese máximo. Alcanza con encontrar una sola
    -- inscripción en infracción para rechazar toda la sentencia.
    select i.id as inscription_id,
           e.max_juegos_por_participante as v_max,
           count(*) as v_cantidad
      into v_violation
      from inscriptions i
      join events e on e.id = i.id_evento
      join games_inscriptions gi on gi.id_inscription = i.id
     where i.id in (select distinct id_inscription from inserted_games)
       and e.modo_seleccion_juegos = 'libre'
       and e.max_juegos_por_participante is not null
     group by i.id, e.max_juegos_por_participante
    having count(*) > e.max_juegos_por_participante
     limit 1;

    if found then
        raise exception 'EVENT_GAME_LIMIT_EXCEEDED'
            using errcode = 'LCE04',
                  detail = format(
                      'La inscripción %s quedó con más juegos (%s) que el máximo permitido por el evento (%s).',
                      v_violation.inscription_id, v_violation.v_cantidad, v_violation.v_max
                  );
    end if;

    return null; -- ignorado en triggers AFTER STATEMENT
end;
$$;

-- `trg_enforce_event_game_limit` (sin sufijo) es el nombre de una versión
-- previa de esta migración que intentaba combinar INSERT y UPDATE en un solo
-- trigger con tabla de transición — inválido en Postgres (ver el comentario
-- de más arriba). Se elimina acá por si esa versión llegó a aplicarse contra
-- alguna base de prueba antes de esta corrección.
drop trigger if exists trg_enforce_event_game_limit on games_inscriptions;

drop trigger if exists trg_enforce_event_game_limit_insert on games_inscriptions;
create trigger trg_enforce_event_game_limit_insert
    after insert on games_inscriptions
    referencing new table as inserted_games
    for each statement
    execute function enforce_event_game_limit();

drop trigger if exists trg_enforce_event_game_limit_update on games_inscriptions;
create trigger trg_enforce_event_game_limit_update
    after update on games_inscriptions
    referencing new table as inserted_games
    for each statement
    execute function enforce_event_game_limit();

-- ============================================================================
-- Sección 4: restricción UNIQUE real (id_inscription, id_game)
-- ============================================================================
--
-- Columnas reales verificadas contra el código (no asumidas): `games_inscriptions`
-- usa `id_inscription` (FK -> inscriptions.id) e `id_game` (FK -> games.id) —
-- ver los `.insert({ id_inscription, id_game })` en Confirmacion.jsx y
-- ConfirmacionEquipo.jsx, y el `.select('id_game')...in('id_inscription', ...)`
-- en EventsList.jsx. No existe ninguna variante `id_inscriptions` en el código.
--
-- A diferencia de la primera versión de esta migración, este chequeo NO queda
-- comentado ni depende de que una persona lea a mano el resultado de un
-- SELECT antes de decidir si aplicar el UNIQUE: el bloque `do $$ ... $$`
-- siguiente cuenta los duplicados existentes y, si encuentra alguno, aborta
-- la sentencia (y por lo tanto toda la transacción de este archivo, ver el
-- `begin;` del principio) con `raise exception` — no borra, fusiona ni
-- modifica ninguna fila automáticamente. Si no hay duplicados, el bloque no
-- hace nada y el `alter table` de abajo agrega el UNIQUE real.
do $$
declare
    v_grupos_duplicados integer;
    v_filas_duplicadas integer;
begin
    select count(*), coalesce(sum(cantidad), 0)
      into v_grupos_duplicados, v_filas_duplicadas
      from (
          select id_inscription, id_game, count(*) as cantidad
            from games_inscriptions
           group by id_inscription, id_game
          having count(*) > 1
      ) dup;

    if v_grupos_duplicados > 0 then
        raise exception
            'GAMES_INSCRIPTIONS_DUPLICATE_ROWS_FOUND: hay % combinación(es) de (id_inscription, id_game) repetidas en games_inscriptions (% filas involucradas en total). No se aplicó el UNIQUE ni ningún otro cambio de esta migración — esta transacción completa se revierte. Hay que resolver los duplicados a mano (decidir cuál fila conservar por cada combinación repetida, mismo criterio que se usó para los slugs duplicados en 20260730_events_slug_unique.sql) y volver a correr este archivo. Para identificar los duplicados: select id_inscription, id_game, count(*) from games_inscriptions group by id_inscription, id_game having count(*) > 1;',
            v_grupos_duplicados, v_filas_duplicadas
            using errcode = 'LCE05';
    end if;
end;
$$;

alter table games_inscriptions
    add constraint games_inscriptions_inscription_game_key
        unique (id_inscription, id_game);

commit;

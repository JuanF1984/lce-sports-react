-- Administración de videojuegos (games) desde el panel admin — Etapa 1.
--
-- Alcance de esta migración (ver docs/games.md para el detalle completo del
-- relevamiento previo): agrega `image_path` a `games`, protege `game_name`
-- contra duplicados (case-insensitive) y agrega RLS con SELECT público /
-- INSERT+UPDATE solo admin. NO agrega DELETE — el panel admin de esta etapa
-- nunca borra juegos (baja lógica futura vía `active`, fuera de alcance acá).
-- NO toca `active`, `team_option` ni `principal` — sus valores/semántica no
-- cambian, solo se agrega la columna nueva y las policies.
--
-- CÓMO CORRER ESTA MIGRACIÓN: pegar el archivo completo en el SQL Editor de
-- Supabase y ejecutarlo de una sola vez. Corre dentro de una única
-- transacción explícita (`begin;` / `commit;` más abajo): si cualquier paso
-- falla (en particular, la Sección 2 si hay nombres duplicados), no queda
-- nada de este archivo aplicado.
--
-- SUPUESTOS QUE NO SE PUDIERON VERIFICAR CONTRA LA BASE REAL (sin acceso
-- directo a Supabase desde este entorno):
--
-- 1) Función `is_admin()`: las policies de la Sección 3 la reutilizan tal
--    cual, sin redefinirla — mismo aviso ya documentado para
--    supabase/migrations/20260810_gallery_items.sql. Antes de correr la
--    Sección 3, confirmar que existe:
--        select proname from pg_proc where proname = 'is_admin';
--    Si no existe, el `create policy` va a fallar con
--    "function is_admin() does not exist".
--
-- 2) RLS actual de `games`: no hay ningún dato en el repo sobre si `games`
--    ya tiene RLS habilitado hoy (ver docs/games.md, "no aparece mencionada
--    en RLS/permisos"). Esta migración agrega una policy de SELECT
--    totalmente abierta (`using (true)`) — esto solo puede MANTENER o
--    AMPLIAR el acceso de lectura público que ya existe hoy (el flujo
--    público de inscripción ya lee `games` sin problema, así que la lectura
--    ya está abierta de algún modo); no hay forma de que esta policy
--    empeore la lectura pública actual. Las policies de INSERT/UPDATE son
--    nuevas restricciones, pero gatean una funcionalidad que hoy no existe
--    en el código (no hay ningún INSERT/UPDATE contra `games` en el repo
--    antes de esta etapa), así que no rompen nada existente.
--
-- 3) Duplicados existentes en `game_name`: la Sección 2 comprueba esto ella
--    misma antes de aplicar el índice UNIQUE — ver el detalle ahí.

begin;

-- ============================================================================
-- Sección 1: columna `image_path`
-- ============================================================================
-- Nullable a propósito: los juegos existentes siguen dependiendo de
-- src/data/gameConfig.js + assets hardcodeados en esta etapa (no se toca esa
-- lógica, ver docs/games.md). `image_path = null` es el estado esperado y
-- válido para todo juego que no haya cargado imagen desde el panel todavía.
alter table games
    add column if not exists image_path text;

-- ============================================================================
-- Sección 2: protección contra nombres duplicados (case-insensitive)
-- ============================================================================
-- Mismo patrón que la Sección 4 de
-- supabase/migrations/20260804_event_participation_rules.sql (el UNIQUE de
-- games_inscriptions): antes de crear el índice, se comprueba si ya existen
-- duplicados reales en los datos actuales. Si los hay, se aborta con
-- `raise exception` — no se borra, fusiona ni modifica ninguna fila
-- automáticamente, y como corre dentro de la transacción del archivo
-- completo, el aborto revierte también la Sección 1 (columna `image_path`):
-- o se aplica todo el archivo, o no se aplica nada.
--
-- La comparación es sobre `lower(btrim(game_name))` (sin mayúsculas, sin
-- espacios al borde) — no un UNIQUE plano sobre `game_name` tal cual. Esto
-- es a propósito: el riesgo real documentado en docs/games.md no es dos
-- filas con el string idéntico, es variantes como "CS2"/"cs2"/" CS2 " que
-- además rompen el lookup case-sensitive de gameConfig.js si conviven. Un
-- índice UNIQUE plano no las detectaría.
do $$
declare
    v_grupos_duplicados integer;
    v_filas_duplicadas integer;
begin
    select count(*), coalesce(sum(cantidad), 0)
      into v_grupos_duplicados, v_filas_duplicadas
      from (
          select lower(btrim(game_name)) as nombre_normalizado, count(*) as cantidad
            from games
           group by lower(btrim(game_name))
          having count(*) > 1
      ) dup;

    if v_grupos_duplicados > 0 then
        raise exception
            'GAMES_DUPLICATE_NAME_ROWS_FOUND: hay % nombre(s) de juego repetidos (comparación sin mayúsculas/espacios) en games (% filas involucradas en total). No se aplicó el índice UNIQUE ni ningún otro cambio de este archivo — esta transacción completa se revierte. Hay que resolver los duplicados a mano (decidir cuál fila conservar por cada nombre repetido — atención: games_inscriptions.id_game y event_games.game_id pueden referenciar cualquiera de las filas duplicadas, revisar antes de borrar una) y volver a correr este archivo. Para identificar los duplicados: select game_name, count(*) from games group by lower(btrim(game_name)) having count(*) > 1;',
            v_grupos_duplicados, v_filas_duplicadas
            using errcode = 'LCE07';
    end if;
end;
$$;

create unique index if not exists games_game_name_unique_ci
    on games (lower(btrim(game_name)));

-- ============================================================================
-- Sección 3: RLS
-- ============================================================================
-- SELECT público (el flujo de inscripción y el resto del sitio ya leen
-- `games` sin login). INSERT/UPDATE solo admin, vía is_admin() (ver aviso al
-- principio del archivo). Sin policy de DELETE — a propósito, el panel de
-- esta etapa no borra juegos (ver docs/games.md, "No permitir DELETE
-- físico").
alter table games enable row level security;

drop policy if exists games_select_public on games;
create policy games_select_public
    on games
    for select
    using (true);

drop policy if exists games_insert_admin on games;
create policy games_insert_admin
    on games
    for insert
    with check (is_admin());

drop policy if exists games_update_admin on games;
create policy games_update_admin
    on games
    for update
    using (is_admin())
    with check (is_admin());

commit;

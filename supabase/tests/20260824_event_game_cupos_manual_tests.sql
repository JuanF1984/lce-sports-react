-- Pruebas manuales para supabase/migrations/20260824_event_game_cupos.sql
--
-- ESTE ARCHIVO NO ES UNA MIGRACIÓN. No se ejecuta automáticamente en ningún
-- lado (no hay CLI de Supabase ni runner de migraciones en este repo, ver
-- docs/supabase.md) y no debe correrse como parte de la migración real. Es
-- una guía para pegar bloques SUELTOS en el SQL Editor de Supabase, uno por
-- vez, leyendo el resultado de cada uno antes de seguir con el siguiente,
-- **después** de haber aplicado la migración `20260824_event_game_cupos.sql`
-- contra una base de prueba (nunca contra producción). Mismo patrón que
-- `supabase/tests/20260804_event_participation_rules_manual_tests.sql`.
--
-- Usa nombres bien marcados (`TEST_CUPO_...`) para que la sección de limpieza
-- del final pueda borrar todo sin arrastrar datos reales. No corras esto
-- contra una base que ya tenga eventos/juegos con esos nombres.
--
-- Numeración alineada con el pedido original (15 escenarios mínimos):
--   1  juego sin límite
--   2  juego con cupo disponible
--   3  inscripción que completa exactamente el cupo
--   4  intento cuando ya está completo
--   5  cupo_maximo = 0
--   6  dos altas concurrentes por el último cupo (requiere dos sesiones)
--   7  equipo con cupos suficientes (RPC)
--   8  equipo sin cupos suficientes (RPC)
--   9  equipo rechazado no deja integrantes parciales
--   10 reducción de cupo por debajo de ocupados
--   11 distintos eventos, mismo juego, cupos independientes
--   12 distintos juegos, mismo evento, cupos independientes
--   13 edición del evento conserva cupo_maximo (simulación del patrón
--      delete+insert que usa EventsList.jsx)
--   14 juegos con cupo_maximo NULL siguen sin límite
--   15 flujo individual normal sigue funcionando (regresión)
--   16 UPDATE sobre games_inscriptions (mover fila hacia un juego que se
--      pasa de cupo, confirmar rollback total, y confirmar que NO hay doble
--      conteo de la fila movida)
--   17 bypass de cupo con game_id no asociado al evento — cerrado en
--      auditoría de seguridad (individual y RPC de equipo)
--   18 RPC de equipo contra un juego con registration_mode = 'individual' —
--      cerrado en la misma auditoría
--   19 confirma que la firma vieja de register_team_inscription (con
--      p_user_id) no sobrevive
--
-- NOTA (tras un intento real de aplicar la migración): la primera versión
-- asumía IDs `bigint` y falló contra la base real con
-- "operator does not exist: uuid = bigint" — el esquema real usa `uuid`
-- (ver el encabezado de la migración para el detalle completo de qué se
-- probó y qué se infirió). Los tests de este archivo nunca hardcodearon un
-- tipo (siempre resuelven ids con subqueries `select id from ... where
-- nombre = '...'`), así que no hizo falta tocar ninguno más allá del texto
-- de la prueba 19. Se agregó la prueba 0 para confirmar los tipos reales
-- ANTES de correr el resto.

-- ============================================================================
-- 0) Confirmar tipos reales de columnas antes de correr el resto de las
--    pruebas — si esto no da `uuid` para las filas de abajo, PARAR y revisar
--    la migración de nuevo antes de seguir (no asumir que el resto de las
--    pruebas es válido contra un esquema distinto).
-- ============================================================================

select table_name, column_name, data_type
  from information_schema.columns
 where (table_name = 'events' and column_name = 'id')
    or (table_name = 'games' and column_name = 'id')
    or (table_name = 'event_games' and column_name in ('id', 'event_id', 'game_id', 'cupo_maximo'))
    or (table_name = 'inscriptions' and column_name in ('id', 'id_evento', 'edad', 'user_id'))
    or (table_name = 'games_inscriptions' and column_name in ('id', 'id_inscription', 'id_game'))
 order by table_name, column_name;
-- Esperado: `data_type = 'uuid'` para todas las columnas de id/FK listadas
-- (id, id_evento, event_id, game_id, id_inscription, id_game, user_id) y
-- `data_type = 'integer'` para `cupo_maximo` (agregada por esta migración,
-- Sección 1). `edad` se incluye solo para confirmar su tipo real (ver el
-- supuesto documentado en la migración) — no debería ser `uuid`.

-- ============================================================================
-- SETUP
-- ============================================================================

insert into games (game_name, team_option, principal, active) values
    ('TEST_CUPO_GAME_A', true,  true,  true),
    ('TEST_CUPO_GAME_B', false, false, true);

insert into events (nombre, localidad, fecha_inicio, tipo, visible_en_home,
                     modo_seleccion_juegos)
values ('TEST_CUPO_EVENTO_1', 'Test', current_date, 'torneo', false, 'clasificado');

insert into events (nombre, localidad, fecha_inicio, tipo, visible_en_home,
                     modo_seleccion_juegos)
values ('TEST_CUPO_EVENTO_2', 'Test', current_date, 'torneo', false, 'clasificado');

-- event_games: GAME_A en EVENTO_1 con cupo 2 (para completarlo fácil);
-- GAME_A en EVENTO_2 con cupo 5 (evento distinto, mismo juego → prueba 11);
-- GAME_B en EVENTO_1 sin cupo (NULL → pruebas 1/14) y luego se vuelve a usar
-- para cupo 0 (prueba 5) sobre una fila aparte.
insert into event_games (event_id, game_id, registration_mode, cupo_maximo)
values
    ((select id from events where nombre = 'TEST_CUPO_EVENTO_1'),
     (select id from games  where game_name = 'TEST_CUPO_GAME_A'), 'both', 2),
    ((select id from events where nombre = 'TEST_CUPO_EVENTO_2'),
     (select id from games  where game_name = 'TEST_CUPO_GAME_A'), 'both', 5),
    ((select id from events where nombre = 'TEST_CUPO_EVENTO_1'),
     (select id from games  where game_name = 'TEST_CUPO_GAME_B'), 'individual', null);

-- ============================================================================
-- 1) Juego sin límite (GAME_B en EVENTO_1, cupo_maximo NULL): cualquier
--    cantidad de inscripciones entra sin problema.
-- ============================================================================

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestCupoSinLimite1', 'Apellido', '20', '40000001', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_1'));
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestCupoSinLimite2', 'Apellido', '20', '40000002', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_1'));

insert into games_inscriptions (id_inscription, id_game)
select id, (select id from games where game_name = 'TEST_CUPO_GAME_B')
  from inscriptions where nombre in ('TestCupoSinLimite1', 'TestCupoSinLimite2');
-- Esperado: INSERT 0 2, sin error (cupo_maximo NULL nunca se evalúa).

-- ============================================================================
-- 2) y 3) Juego con cupo disponible (GAME_A en EVENTO_1, cupo 2): la primera
--    persona entra con cupo de sobra, la segunda completa EXACTAMENTE el cupo.
-- ============================================================================

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestCupoDisponible', 'Apellido', '20', '40000003', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_1'));
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestCupoDisponible'),
        (select id from games where game_name = 'TEST_CUPO_GAME_A'));
-- Esperado: INSERT 0 1, sin error (1 de 2 ocupado).

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestCupoCompletaExacto', 'Apellido', '20', '40000004', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_1'));
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestCupoCompletaExacto'),
        (select id from games where game_name = 'TEST_CUPO_GAME_A'));
-- Esperado: INSERT 0 1, sin error (2 de 2 — completa exacto, no debe rechazar).

-- ============================================================================
-- 4) Intento de inscripción cuando el juego ya está completo (2/2 desde el
--    paso anterior) → rechaza.
-- ============================================================================

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestCupoYaCompleto', 'Apellido', '20', '40000005', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_1'));
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestCupoYaCompleto'),
        (select id from games where game_name = 'TEST_CUPO_GAME_A'));
-- Esperado: ERROR: EVENT_GAME_CUPO_EXCEEDED (errcode LCE06).

select count(*) as filas_de_testcupoyacompleto from games_inscriptions
 where id_inscription = (select id from inscriptions where nombre = 'TestCupoYaCompleto');
-- Esperado: 0 (el rechazo no dejó ninguna fila).

-- ============================================================================
-- 5) cupo_maximo = 0 → rechaza cualquier alta, incluso la primera.
-- ============================================================================

insert into event_games (event_id, game_id, registration_mode, cupo_maximo)
values ((select id from events where nombre = 'TEST_CUPO_EVENTO_2'),
        (select id from games  where game_name = 'TEST_CUPO_GAME_B'), 'individual', 0);

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestCupoCero', 'Apellido', '20', '40000006', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_2'));
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestCupoCero'),
        (select id from games where game_name = 'TEST_CUPO_GAME_B'));
-- Esperado: ERROR: EVENT_GAME_CUPO_EXCEEDED (0 personas ya es "count(*) > 0" para la 1ra fila).

-- ============================================================================
-- 6) CONCURRENCIA — dos altas simultáneas por el último cupo. Requiere DOS
--    sesiones SQL reales (dos pestañas del SQL Editor, o dos conexiones
--    psql). No alcanza con leer el trigger.
-- ============================================================================
--
-- Preparación: un evento con cupo 1 para un juego, sin nadie inscripto
-- todavía. Correr esto en UNA sola sesión antes de abrir la segunda pestaña.

insert into events (nombre, localidad, fecha_inicio, tipo, visible_en_home)
values ('TEST_CUPO_EVENTO_CONCURRENCIA', 'Test', current_date, 'torneo', false);

insert into event_games (event_id, game_id, registration_mode, cupo_maximo)
values ((select id from events where nombre = 'TEST_CUPO_EVENTO_CONCURRENCIA'),
        (select id from games  where game_name = 'TEST_CUPO_GAME_A'), 'both', 1);

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestConcurrenciaA', 'Apellido', '20', '50000001', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_CONCURRENCIA'));
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestConcurrenciaB', 'Apellido', '20', '50000002', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_CONCURRENCIA'));

-- --- Sesión A ---------------------------------------------------------------
-- A1) Abrir transacción y tomar el único cupo, SIN COMMIT todavía:
begin;
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestConcurrenciaA'),
        (select id from games where game_name = 'TEST_CUPO_GAME_A'));
-- A1 debería devolver INSERT 0 1 sin error todavía (nadie más compitió por
-- el lock de event_games hasta ahora).

-- --- Sesión B (pestaña/conexión aparte) -------------------------------------
-- B1) Mientras A sigue sin COMMIT, intentar tomar el mismo (único) cupo:
begin;
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestConcurrenciaB'),
        (select id from games where game_name = 'TEST_CUPO_GAME_A'));
-- B1 debe quedar BLOQUEADA (sin devolver resultado) — esperando el lock de
-- event_games que tomó la sesión A.

-- --- Sesión A ---------------------------------------------------------------
-- A2) Confirmar:
commit;
-- En cuanto A hace commit, B debería desbloquearse sola.

-- --- Sesión B ---------------------------------------------------------------
-- B2) Ver qué pasó apenas se desbloqueó:
-- Esperado: ERROR: EVENT_GAME_CUPO_EXCEEDED — recién al poder contar
-- (después del lock) B ve 1 ya ocupado (por A) + 1 que intenta agregar = 2,
-- por encima del cupo de 1.
commit; -- (o rollback si B ya abortó sola por el error)

select count(*) as total_final from games_inscriptions
 where id_game = (select id from games where game_name = 'TEST_CUPO_GAME_A')
   and id_inscription in (
       select id from inscriptions where nombre in ('TestConcurrenciaA', 'TestConcurrenciaB')
   );
-- Esperado: 1 (solo A quedó inscripta; nunca 0 ni 2).

-- ============================================================================
-- 7), 8) y 9) RPC register_team_inscription — equipo con/sin cupos
--    suficientes, y verificación de que un rechazo no deja integrantes.
-- ============================================================================

-- Evento nuevo con cupo 3 para GAME_A (equipo de 5 no entra completo, equipo
-- de 2 sí).
insert into events (nombre, localidad, fecha_inicio, tipo, visible_en_home)
values ('TEST_CUPO_EVENTO_EQUIPOS', 'Test', current_date, 'torneo', false);

insert into event_games (event_id, game_id, registration_mode, cupo_maximo)
values ((select id from events where nombre = 'TEST_CUPO_EVENTO_EQUIPOS'),
        (select id from games  where game_name = 'TEST_CUPO_GAME_A'), 'team', 3);

-- 7) Equipo de 2 (capitán + 1 jugador) contra un cupo de 3 → entra completo.
select register_team_inscription(
    (select id from events where nombre = 'TEST_CUPO_EVENTO_EQUIPOS'),
    (select id from games  where game_name = 'TEST_CUPO_GAME_A'),
    jsonb_build_object(
        'nombre', 'CapitanOk', 'apellido', 'Apellido', 'edad', '20',
        'email', 'capitanok@test.com', 'celular', '60000001',
        'localidad', 'Test', 'team_name', 'TEST_EQUIPO_OK'
    ),
    jsonb_build_array(
        jsonb_build_object('nombre', 'JugadorOk1', 'apellido', 'Apellido', 'edad', '19',
                            'email', null, 'celular', '60000002')
    )
);
-- Esperado: devuelve un jsonb con "captain" y "players" (1 elemento), sin error.

select count(*) as personas_equipo_ok from inscriptions where team_name = 'TEST_EQUIPO_OK';
-- Esperado: 2 (capitán + 1 jugador).
select count(*) as juegos_equipo_ok from games_inscriptions gi
  join inscriptions i on i.id = gi.id_inscription
 where i.team_name = 'TEST_EQUIPO_OK';
-- Esperado: 2 (una fila de games_inscriptions por cada integrante).

-- 8) Equipo de 3 más (capitán + 2 jugadores) contra el cupo que ya quedó en
--    2/3 ocupado (por el equipo de la prueba 7) → solo queda 1 lugar, el
--    equipo de 3 no entra completo.
select register_team_inscription(
    (select id from events where nombre = 'TEST_CUPO_EVENTO_EQUIPOS'),
    (select id from games  where game_name = 'TEST_CUPO_GAME_A'),
    jsonb_build_object(
        'nombre', 'CapitanFalla', 'apellido', 'Apellido', 'edad', '20',
        'email', 'capitanfalla@test.com', 'celular', '60000003',
        'localidad', 'Test', 'team_name', 'TEST_EQUIPO_FALLA'
    ),
    jsonb_build_array(
        jsonb_build_object('nombre', 'JugadorFalla1', 'apellido', 'Apellido', 'edad', '19',
                            'email', null, 'celular', '60000004'),
        jsonb_build_object('nombre', 'JugadorFalla2', 'apellido', 'Apellido', 'edad', '19',
                            'email', null, 'celular', '60000005')
    )
);
-- Esperado: ERROR: EVENT_GAME_CUPO_EXCEEDED (errcode LCE06) — 2 ya ocupados +
-- 3 del equipo nuevo = 5, por encima del cupo de 3.

-- 9) Confirmar que el equipo rechazado NO dejó ningún integrante guardado
--    (ni el capitán, que se insertó primero dentro de la misma función,
--    antes de llegar al INSERT de games_inscriptions que disparó el error).
select count(*) as personas_equipo_falla from inscriptions where team_name = 'TEST_EQUIPO_FALLA';
-- Esperado: 0 — la función completa se revirtió, incluido el capitán.

select count(*) as total_ocupado_final from games_inscriptions gi
  join inscriptions i on i.id = gi.id_inscription
 where i.id_evento = (select id from events where nombre = 'TEST_CUPO_EVENTO_EQUIPOS')
   and gi.id_game = (select id from games where game_name = 'TEST_CUPO_GAME_A');
-- Esperado: 2 (solo el equipo de la prueba 7 — el intento fallido de la 8/9
-- no sumó ni dejó ningún resto).

-- ============================================================================
-- 10) Reducción de cupo por debajo de lo ya ocupado: no borra a nadie, pero
--     bloquea altas nuevas hasta regularizarse.
-- ============================================================================

-- El evento TEST_CUPO_EVENTO_1 / GAME_A quedó en 2/2 (pruebas 2-4). Bajamos
-- el cupo a 1 (por debajo de lo ocupado) — debe permitir el UPDATE sin
-- problema (el trigger de cupo solo corre sobre games_inscriptions, no sobre
-- event_games).
update event_games
   set cupo_maximo = 1
 where event_id = (select id from events where nombre = 'TEST_CUPO_EVENTO_1')
   and game_id = (select id from games where game_name = 'TEST_CUPO_GAME_A');
-- Esperado: UPDATE 1, sin error.

select count(*) as siguen_inscriptos from games_inscriptions gi
  join inscriptions i on i.id = gi.id_inscription
 where i.id_evento = (select id from events where nombre = 'TEST_CUPO_EVENTO_1')
   and gi.id_game = (select id from games where game_name = 'TEST_CUPO_GAME_A');
-- Esperado: 2 — nadie se borró ni se invalidó por bajar el cupo.

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestCupoTrasReduccion', 'Apellido', '20', '40000007', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_1'));
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestCupoTrasReduccion'),
        (select id from games where game_name = 'TEST_CUPO_GAME_A'));
-- Esperado: ERROR: EVENT_GAME_CUPO_EXCEEDED — 2 ya ocupados > cupo nuevo (1),
-- ninguna alta nueva se acepta hasta bajar la ocupación o subir el cupo.

-- ============================================================================
-- 11) Mismo juego (GAME_A), dos eventos distintos → cupos independientes.
--     EVENTO_1/GAME_A ya está en 2/1 (sobre-ocupado, prueba 10).
--     EVENTO_2/GAME_A tiene cupo 5, todavía en 0 — debe aceptar altas
--     normalmente sin que le importe nada de lo que pasó en EVENTO_1.
-- ============================================================================

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestCupoOtroEvento', 'Apellido', '20', '40000008', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_2'));
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestCupoOtroEvento'),
        (select id from games where game_name = 'TEST_CUPO_GAME_A'));
-- Esperado: INSERT 0 1, sin error (EVENTO_2/GAME_A sigue en 1/5, no comparte
-- cupo con EVENTO_1/GAME_A).

-- ============================================================================
-- 12) Mismo evento (EVENTO_2), dos juegos distintos → cupos independientes.
--     GAME_B en EVENTO_2 ya está en 0/0 (prueba 5 lo dejó rechazado, cupo 0).
--     GAME_A en EVENTO_2 acaba de aceptar una inscripción (prueba 11) sin que
--     le afecte el estado "completo" de GAME_B en el mismo evento.
-- ============================================================================

select count(*) as ocupados_game_a_evento_2 from games_inscriptions gi
  join inscriptions i on i.id = gi.id_inscription
 where i.id_evento = (select id from events where nombre = 'TEST_CUPO_EVENTO_2')
   and gi.id_game = (select id from games where game_name = 'TEST_CUPO_GAME_A');
-- Esperado: 1.

select count(*) as ocupados_game_b_evento_2 from games_inscriptions gi
  join inscriptions i on i.id = gi.id_inscription
 where i.id_evento = (select id from events where nombre = 'TEST_CUPO_EVENTO_2')
   and gi.id_game = (select id from games where game_name = 'TEST_CUPO_GAME_B');
-- Esperado: 0 (el intento de la prueba 5 fue rechazado, no dejó fila).

-- ============================================================================
-- 13) Edición del evento conserva cupo_maximo — simulación del patrón real
--     que usa EventsList.jsx (borra TODAS las filas de event_games del
--     evento y las reinserta con los valores del formulario, cupo_maximo
--     incluido). Confirma que el valor sobrevive ese ciclo cuando el
--     formulario lo reenvía explícitamente.
-- ============================================================================

delete from event_games
 where event_id = (select id from events where nombre = 'TEST_CUPO_EVENTO_2');

insert into event_games (event_id, game_id, registration_mode, cupo_maximo)
values
    ((select id from events where nombre = 'TEST_CUPO_EVENTO_2'),
     (select id from games  where game_name = 'TEST_CUPO_GAME_A'), 'both', 5),
    ((select id from events where nombre = 'TEST_CUPO_EVENTO_2'),
     (select id from games  where game_name = 'TEST_CUPO_GAME_B'), 'individual', 0);

select game_id, cupo_maximo from event_games
 where event_id = (select id from events where nombre = 'TEST_CUPO_EVENTO_2')
 order by game_id;
-- Esperado: GAME_A con 5, GAME_B con 0 — ambos valores sobrevivieron al
-- delete+insert, tal como los reenvía EventsList.jsx.

-- ============================================================================
-- 14) Juegos con cupo_maximo NULL siguen sin límite (repite el espíritu de
--     la prueba 1, pero después de que YA existen otros event_games con
--     cupo configurado en la base — confirma que un trigger no "contamina"
--     a otro par evento+juego sin límite).
-- ============================================================================

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestCupoNullSigueSinLimite', 'Apellido', '20', '40000009', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_1'));
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestCupoNullSigueSinLimite'),
        (select id from games where game_name = 'TEST_CUPO_GAME_B'));
-- Esperado: INSERT 0 1, sin error (GAME_B en EVENTO_1 sigue en NULL).

-- ============================================================================
-- 15) Regresión: flujo individual normal (sin ningún cupo cerca del límite)
--     sigue funcionando exactamente igual que antes de esta migración.
-- ============================================================================

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestFlujoIndividualNormal', 'Apellido', '20', '40000010', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_2'));
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestFlujoIndividualNormal'),
        (select id from games where game_name = 'TEST_CUPO_GAME_A'));
-- Esperado: INSERT 0 1, sin error (EVENTO_2/GAME_A: cupo 5, iba en 1, queda en 2).

-- ============================================================================
-- 16) UPDATE sobre games_inscriptions — trigger trg_enforce_event_game_cupo_update.
--     Cubre: (a) mover una fila existente HACIA un juego que queda sobre-
--     ocupado, y (b) confirma que no hay doble conteo de la fila movida (el
--     conteo lee el estado ACTUAL de la tabla después del UPDATE, no suma la
--     fila vieja + la nueva).
-- ============================================================================

-- EVENTO_2/GAME_A está en 2/5 (pruebas 11 y 15). Le bajamos el cupo a 2 para
-- poder completarlo fácil con el UPDATE de abajo.
update event_games
   set cupo_maximo = 2
 where event_id = (select id from events where nombre = 'TEST_CUPO_EVENTO_2')
   and game_id = (select id from games where game_name = 'TEST_CUPO_GAME_A');

-- Juego dedicado para esta prueba, asociado a EVENTO_2 SIN cupo (origen
-- "neutral" de donde mover la fila) — a propósito no se reutiliza GAME_B en
-- EVENTO_2 (quedó con cupo_maximo = 0 desde la prueba 5, así que un insert
-- ahí ya fallaría antes de llegar a probar nada del UPDATE).
insert into games (game_name, team_option, principal, active) values
    ('TEST_CUPO_GAME_C', false, false, true);

insert into event_games (event_id, game_id, registration_mode, cupo_maximo)
values ((select id from events where nombre = 'TEST_CUPO_EVENTO_2'),
        (select id from games  where game_name = 'TEST_CUPO_GAME_C'), 'individual', null);

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestUpdateCupoOrigen', 'Apellido', '20', '40000011', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_2'));

insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestUpdateCupoOrigen'),
        (select id from games where game_name = 'TEST_CUPO_GAME_C'));

-- 16a) Mover esa fila de GAME_C a GAME_A (que ya está en 2/2 → pasaría a 3/2).
update games_inscriptions
   set id_game = (select id from games where game_name = 'TEST_CUPO_GAME_A')
 where id_inscription = (select id from inscriptions where nombre = 'TestUpdateCupoOrigen')
   and id_game = (select id from games where game_name = 'TEST_CUPO_GAME_C');
-- Esperado: ERROR: EVENT_GAME_CUPO_EXCEEDED (errcode LCE06) — GAME_A ya
-- estaba en su tope (2), mover esta fila lo llevaría a 3.

select id_game from games_inscriptions
 where id_inscription = (select id from inscriptions where nombre = 'TestUpdateCupoOrigen');
-- Esperado: sigue apuntando a GAME_C (el UPDATE se revirtió por completo, la
-- fila no quedó "a medio mover").

-- 16b) Verificar que NO hay doble conteo: bajamos el cupo de GAME_A a 3 (para
--      que la misma mudanza SÍ entre) y confirmamos que, tras el UPDATE
--      exitoso, GAME_A queda en EXACTAMENTE 3 (2 que ya tenía + esta 1), no
--      en 4 (lo que pasaría si el trigger contara la fila movida dos veces:
--      una como parte del conteo "general" y otra por aparecer en
--      inserted_games).
update event_games
   set cupo_maximo = 3
 where event_id = (select id from events where nombre = 'TEST_CUPO_EVENTO_2')
   and game_id = (select id from games where game_name = 'TEST_CUPO_GAME_A');

update games_inscriptions
   set id_game = (select id from games where game_name = 'TEST_CUPO_GAME_A')
 where id_inscription = (select id from inscriptions where nombre = 'TestUpdateCupoOrigen')
   and id_game = (select id from games where game_name = 'TEST_CUPO_GAME_C');
-- Esperado: UPDATE 1, sin error.

select count(*) as total_game_a_evento_2 from games_inscriptions gi
  join inscriptions i on i.id = gi.id_inscription
 where i.id_evento = (select id from events where nombre = 'TEST_CUPO_EVENTO_2')
   and gi.id_game = (select id from games where game_name = 'TEST_CUPO_GAME_A');
-- Esperado: EXACTAMENTE 3 (no 4). Confirma que no hay doble conteo de la
-- fila movida por el UPDATE.

-- 16c) UPDATE "sin cambios reales" (mismo id_game de siempre) sobre una fila
--      de un grupo que YA está en su tope exacto (3/3, recién dejado así por
--      16b): no debería fallar — el conteo total no cambia porque ninguna
--      fila entra ni sale, solo se "toca" una que ya estaba contada.
update games_inscriptions
   set id_game = id_game
 where id_inscription = (select id from inscriptions where nombre = 'TestUpdateCupoOrigen')
   and id_game = (select id from games where game_name = 'TEST_CUPO_GAME_A');
-- Esperado: UPDATE 1, SIN error — tocar una fila sin cambiar la combinación
-- (evento, juego) no puede hacer que el conteo supere el cupo si no lo
-- superaba ya antes (y acá está exactamente en el límite, no por encima).

-- ============================================================================
-- 17) Bypass de cupo con un game_id que no pertenece al evento — cerrado en
--     la auditoría de seguridad (antes de esta corrección, un par sin fila
--     en event_games no activaba ningún chequeo de cupo).
-- ============================================================================

-- 17a) Flujo individual (insert directo en games_inscriptions): TEST_CUPO_GAME_A
--      NO está asociado a TEST_CUPO_EVENTO_CONCURRENCIA (ver setup de la
--      prueba 6 — ahí sí lo está; usamos un evento sin ninguna asociación).
insert into events (nombre, localidad, fecha_inicio, tipo, visible_en_home)
values ('TEST_CUPO_EVENTO_SIN_JUEGOS', 'Test', current_date, 'torneo', false);

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestBypassSinEventGames', 'Apellido', '20', '40000012', 'Test',
        (select id from events where nombre = 'TEST_CUPO_EVENTO_SIN_JUEGOS'));

insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestBypassSinEventGames'),
        (select id from games where game_name = 'TEST_CUPO_GAME_A'));
-- Esperado: ERROR: EVENT_GAME_NOT_CONFIGURED (errcode LCE10) — GAME_A no
-- está asociado a TEST_CUPO_EVENTO_SIN_JUEGOS vía event_games, así que no
-- hay ningún cupo que hacer cumplir para ese par y el trigger lo rechaza en
-- vez de dejarlo pasar en silencio.

-- 17b) Mismo bypass, pero vía el RPC de equipo.
select register_team_inscription(
    (select id from events where nombre = 'TEST_CUPO_EVENTO_SIN_JUEGOS'),
    (select id from games  where game_name = 'TEST_CUPO_GAME_A'),
    jsonb_build_object(
        'nombre', 'CapitanBypass', 'apellido', 'Apellido', 'edad', '20',
        'email', 'capitanbypass@test.com', 'celular', '60000006',
        'localidad', 'Test', 'team_name', 'TEST_EQUIPO_BYPASS'
    ),
    '[]'::jsonb
);
-- Esperado: ERROR: EVENT_GAME_NOT_CONFIGURED (errcode LCE10) — lo rechaza el
-- chequeo explícito de la función, ANTES de insertar nada.

select count(*) as personas_equipo_bypass from inscriptions where team_name = 'TEST_EQUIPO_BYPASS';
-- Esperado: 0 — ni siquiera el capitán quedó guardado.

-- ============================================================================
-- 18) RPC de equipo contra un juego con registration_mode = 'individual' →
--     rechaza, cerrado en la misma auditoría de seguridad.
-- ============================================================================

-- TEST_CUPO_GAME_B en TEST_CUPO_EVENTO_1 tiene registration_mode='individual'
-- desde el setup inicial de este archivo.
select register_team_inscription(
    (select id from events where nombre = 'TEST_CUPO_EVENTO_1'),
    (select id from games  where game_name = 'TEST_CUPO_GAME_B'),
    jsonb_build_object(
        'nombre', 'CapitanIndividualOnly', 'apellido', 'Apellido', 'edad', '20',
        'email', 'capitanindividualonly@test.com', 'celular', '60000007',
        'localidad', 'Test', 'team_name', 'TEST_EQUIPO_INDIVIDUAL_ONLY'
    ),
    '[]'::jsonb
);
-- Esperado: ERROR: TEAM_NOT_ALLOWED_FOR_GAME (errcode LCE11).

select count(*) as personas_equipo_individual_only from inscriptions
 where team_name = 'TEST_EQUIPO_INDIVIDUAL_ONLY';
-- Esperado: 0.

-- ============================================================================
-- 19) auth.uid() en vez de user_id fabricado por el cliente — no se puede
--     probar el valor exacto de auth.uid() desde el SQL Editor (una sesión
--     de SQL Editor no lleva el JWT de un usuario real, auth.uid() da NULL
--     ahí, igual que un llamado anónimo real) — lo que SÍ se puede confirmar
--     desde acá es que la función YA NO ACEPTA un parámetro para fabricar el
--     user_id: la firma vieja (con p_user_id) no debe existir más.
-- ============================================================================

select p.proname, pg_get_function_arguments(p.oid) as argumentos
  from pg_proc p
 where p.proname = 'register_team_inscription';
-- Esperado: UNA sola fila, con argumentos "p_event_id uuid, p_game_id uuid,
-- p_captain jsonb, p_players jsonb DEFAULT '[]'::jsonb" — SIN p_user_id (y
-- con event_id/game_id como uuid, no bigint — ver la corrección de tipos al
-- principio de la migración). Si
-- aparece más de una fila (una función sobrecargada con la firma vieja),
-- revisar que el DROP FUNCTION de la migración se haya aplicado.

-- ============================================================================
-- TEARDOWN — borra todo lo creado por este archivo
-- ============================================================================

delete from games_inscriptions
 where id_inscription in (
     select id from inscriptions where id_evento in (
         select id from events where nombre like 'TEST_CUPO_%'
     ) or team_name like 'TEST_EQUIPO_%'
 );

delete from inscriptions
 where id_evento in (select id from events where nombre like 'TEST_CUPO_%')
    or team_name like 'TEST_EQUIPO_%';

delete from event_games
 where event_id in (select id from events where nombre like 'TEST_CUPO_%');

delete from events where nombre like 'TEST_CUPO_%';

delete from games where game_name like 'TEST_CUPO_GAME_%';

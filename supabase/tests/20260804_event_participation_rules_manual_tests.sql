-- Pruebas manuales para supabase/migrations/20260804_event_participation_rules.sql
--
-- ESTE ARCHIVO NO ES UNA MIGRACIÓN. No se ejecuta automáticamente en ningún
-- lado (no hay CLI de Supabase ni runner de migraciones en este repo, ver
-- docs/supabase.md) y no debe correrse como parte de la migración real. Es
-- una guía para pegar bloques SUELTOS en el SQL Editor de Supabase, uno por
-- vez, leyendo el resultado de cada uno antes de seguir con el siguiente,
-- **después** de haber aplicado la migración `20260804_event_participation_rules.sql`
-- contra una base de prueba (nunca contra producción).
--
-- Usa nombres bien marcados (`TEST_...`) para que la sección de limpieza del
-- final pueda borrar todo sin arrastrar datos reales. No corras esto contra
-- una base que ya tenga eventos/juegos con esos nombres.
--
-- La sección "JUEGOS" ejercita DOS triggers separados sobre
-- `games_inscriptions` (Postgres no permite combinar INSERT/UPDATE en un
-- solo trigger con tabla de transición, ver la migración): las pruebas 7-16
-- disparan `trg_enforce_event_game_limit_insert` (vía INSERT, de 1 fila o
-- multi-fila) y las pruebas 17-18 disparan `trg_enforce_event_game_limit_update`
-- (vía UPDATE, primero de 1 fila y después multi-fila) — ambos triggers
-- reutilizan la misma función `enforce_event_game_limit()`.

-- ============================================================================
-- SETUP — correr una sola vez antes de cualquier prueba
-- ============================================================================

insert into games (game_name, team_option, principal, active) values
    ('TEST_GAME_A', false, true,  true),
    ('TEST_GAME_B', false, false, true),
    ('TEST_GAME_C', false, false, true),
    ('TEST_GAME_D', false, false, true);

-- Evento con límite de edad (máximo 17, inclusive) y sin reglas de juegos.
insert into events (nombre, localidad, fecha_inicio, tipo, visible_en_home,
                     modo_seleccion_juegos, edad_minima, edad_maxima, max_juegos_por_participante)
values ('TEST_EVENTO_EDAD_MAX17', 'Test', current_date, 'torneo', false,
        'clasificado', null, 17, null);

-- Evento sin ningún límite configurado — control para "comportamiento histórico".
insert into events (nombre, localidad, fecha_inicio, tipo, visible_en_home,
                     modo_seleccion_juegos, edad_minima, edad_maxima, max_juegos_por_participante)
values ('TEST_EVENTO_SIN_LIMITES', 'Test', current_date, 'torneo', false,
        'clasificado', null, null, null);

-- Evento 'libre' sin máximo de juegos.
insert into events (nombre, localidad, fecha_inicio, tipo, visible_en_home,
                     modo_seleccion_juegos, edad_minima, edad_maxima, max_juegos_por_participante)
values ('TEST_EVENTO_LIBRE_SIN_MAX', 'Test', current_date, 'torneo', false,
        'libre', null, null, null);

-- Evento 'libre' con máximo de 3 juegos por participante.
insert into events (nombre, localidad, fecha_inicio, tipo, visible_en_home,
                     modo_seleccion_juegos, edad_minima, edad_maxima, max_juegos_por_participante)
values ('TEST_EVENTO_LIBRE_MAX3', 'Test', current_date, 'torneo', false,
        'libre', null, null, 3);

-- Evento 'clasificado' con un max_juegos_por_participante cargado a propósito
-- (no debería importar: en 'clasificado' el trigger de máximo nunca debe
-- intervenir, sin importar este valor).
insert into events (nombre, localidad, fecha_inicio, tipo, visible_en_home,
                     modo_seleccion_juegos, edad_minima, edad_maxima, max_juegos_por_participante)
values ('TEST_EVENTO_CLASIFICADO_CON_MAX', 'Test', current_date, 'torneo', false,
        'clasificado', null, null, 1);

-- ============================================================================
-- EDAD
-- ============================================================================

-- 1) Participante de 17 años en evento con máximo 17 → permite insertar.
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestEdad17', 'Apellido', '17', '11111111', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_EDAD_MAX17'));
-- Esperado: INSERT 0 1 (sin error).

-- 2) Participante de 18 años → rechaza.
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestEdad18', 'Apellido', '18', '11111112', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_EDAD_MAX17'));
-- Esperado: ERROR: EVENT_MAXIMUM_AGE_EXCEEDED (errcode LCE03).

-- 3) Edad vacía con límite configurado → rechaza.
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestEdadVacia', 'Apellido', '', '11111113', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_EDAD_MAX17'));
-- Esperado: ERROR: INVALID_PARTICIPANT_AGE (errcode LCE01).

-- 4) Edad no numérica → rechaza.
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestEdadTexto', 'Apellido', 'abc', '11111114', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_EDAD_MAX17'));
-- Esperado: ERROR: INVALID_PARTICIPANT_AGE (errcode LCE01).

-- 5) Evento sin límite de edad → conserva el comportamiento anterior (cualquier
--    edad, incluida una que superaría el límite del evento de arriba, entra sin problema).
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestSinLimite99', 'Apellido', '99', '11111115', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_SIN_LIMITES'));
-- Esperado: INSERT 0 1 (sin error).

-- 6) Capitán válido (17) y jugador inválido (18) en el mismo equipo: la fila
--    del capitán se guarda, la del jugador se rechaza (son dos INSERT
--    independientes, igual que hace ConfirmacionEquipo.jsx paso a paso).
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento, team_name)
values ('TestCapitanValido', 'Apellido', '17', '11111116', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_EDAD_MAX17'), 'TEST_EQUIPO_1');
-- Esperado: INSERT 0 1 (sin error) — capitán queda guardado.

insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento, team_name)
values ('TestJugadorInvalido', 'Apellido', '18', '11111117', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_EDAD_MAX17'), 'TEST_EQUIPO_1');
-- Esperado: ERROR: EVENT_MAXIMUM_AGE_EXCEEDED — y el capitán del paso anterior
-- sigue existiendo (confirmar con el SELECT de abajo: debe haber 1 fila, no 0).
select count(*) as capitan_persistido from inscriptions
 where nombre = 'TestCapitanValido' and team_name = 'TEST_EQUIPO_1';
-- Esperado: 1.

-- ============================================================================
-- JUEGOS
-- ============================================================================

-- Inscripción base para las pruebas de "libre sin máximo".
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestLibreSinMax', 'Apellido', '20', '22222221', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_LIBRE_SIN_MAX'));

-- 7) Evento libre sin máximo → permite varios juegos juntos (los 4 de prueba).
insert into games_inscriptions (id_inscription, id_game)
select (select id from inscriptions where nombre = 'TestLibreSinMax'), g.id
  from games g
 where g.game_name in ('TEST_GAME_A', 'TEST_GAME_B', 'TEST_GAME_C', 'TEST_GAME_D');
-- Esperado: INSERT 0 4 (sin error).

-- Inscripción base para las pruebas de "libre con máximo 3".
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestLibreMax3_A', 'Apellido', '20', '22222222', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_LIBRE_MAX3'));

-- 8) Evento libre con máximo 3 → insertar 3 juegos juntos funciona.
insert into games_inscriptions (id_inscription, id_game)
select (select id from inscriptions where nombre = 'TestLibreMax3_A'), g.id
  from games g
 where g.game_name in ('TEST_GAME_A', 'TEST_GAME_B', 'TEST_GAME_C');
-- Esperado: INSERT 0 3 (sin error).

-- Segunda inscripción, para no interferir con la anterior en la prueba de 4.
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestLibreMax3_B', 'Apellido', '20', '22222223', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_LIBRE_MAX3'));

-- 9) Evento libre con máximo 3 → insertar 4 juegos juntos en un solo INSERT falla.
insert into games_inscriptions (id_inscription, id_game)
select (select id from inscriptions where nombre = 'TestLibreMax3_B'), g.id
  from games g
 where g.game_name in ('TEST_GAME_A', 'TEST_GAME_B', 'TEST_GAME_C', 'TEST_GAME_D');
-- Esperado: ERROR: EVENT_GAME_LIMIT_EXCEEDED (errcode LCE04).

-- 10) Confirmar que el INSERT fallido de la prueba 9 no dejó ninguna fila
--     parcial (ni siquiera las primeras 3, que individualmente respetarían el máximo).
select count(*) as filas_parciales from games_inscriptions
 where id_inscription = (select id from inscriptions where nombre = 'TestLibreMax3_B');
-- Esperado: 0.

-- 11) Inscripción con 2 juegos existentes y máximo 3 → agregar 1 más funciona.
--     (Reusa TestLibreMax3_A del paso 8, que ya tiene 3 — primero le sacamos
--     uno a mano para dejarla en 2 antes de esta prueba puntual.)
delete from games_inscriptions
 where id_inscription = (select id from inscriptions where nombre = 'TestLibreMax3_A')
   and id_game = (select id from games where game_name = 'TEST_GAME_C');

insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestLibreMax3_A'),
        (select id from games where game_name = 'TEST_GAME_C'));
-- Esperado: INSERT 0 1 (sin error) — vuelve a quedar en 3, dentro del máximo.

-- 12) La misma inscripción (ya en 3, en el máximo) → agregar 2 juntos falla.
--     Para esto hace falta un quinto juego de prueba (el máximo ya está
--     ocupado por A/B/C, así que agregamos D + un nuevo E puntual para esta prueba).
insert into games (game_name, team_option, principal, active)
values ('TEST_GAME_E', false, false, true);

insert into games_inscriptions (id_inscription, id_game)
select (select id from inscriptions where nombre = 'TestLibreMax3_A'), g.id
  from games g
 where g.game_name in ('TEST_GAME_D', 'TEST_GAME_E');
-- Esperado: ERROR: EVENT_GAME_LIMIT_EXCEEDED — la inscripción ya estaba en el
-- máximo (3) antes de este INSERT, cualquier fila nueva lo supera.

-- 13) Intentar repetir exactamente el mismo juego para la misma inscripción → falla por UNIQUE.
insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestLibreMax3_A'),
        (select id from games where game_name = 'TEST_GAME_A'));
-- Esperado: ERROR: duplicate key value violates unique constraint
-- "games_inscriptions_inscription_game_key" (errcode 23505).

-- 14) Evento 'clasificado' (incluso con max_juegos_por_participante = 1
--     cargado) → el trigger de máximo no interviene, se pueden insertar varios.
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestClasificadoConMax', 'Apellido', '20', '22222224', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_CLASIFICADO_CON_MAX'));

insert into games_inscriptions (id_inscription, id_game)
select (select id from inscriptions where nombre = 'TestClasificadoConMax'), g.id
  from games g
 where g.game_name in ('TEST_GAME_A', 'TEST_GAME_B', 'TEST_GAME_C');
-- Esperado: INSERT 0 3 (sin error) — 'clasificado' ignora max_juegos_por_participante.

-- 15) y 16) Un mismo INSERT con juegos para dos inscripciones distintas, donde
--     una de las dos excede el máximo → debe hacer rollback de TODA la
--     sentencia, incluida la inscripción que individualmente hubiera estado OK.
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestLoteOk', 'Apellido', '20', '22222225', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_LIBRE_MAX3'));
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestLoteExcede', 'Apellido', '20', '22222226', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_LIBRE_MAX3'));

insert into games_inscriptions (id_inscription, id_game)
select
    case datos.participante
        when 'ok'     then (select id from inscriptions where nombre = 'TestLoteOk')
        else               (select id from inscriptions where nombre = 'TestLoteExcede')
    end as id_inscription,
    (select id from games where game_name = datos.game_name) as id_game
  from (values
            ('ok',     'TEST_GAME_A'),
            ('ok',     'TEST_GAME_B'),
            ('excede', 'TEST_GAME_A'),
            ('excede', 'TEST_GAME_B'),
            ('excede', 'TEST_GAME_C'),
            ('excede', 'TEST_GAME_D')
       ) as datos(participante, game_name);
-- Esperado: ERROR: EVENT_GAME_LIMIT_EXCEEDED (TestLoteExcede pide 4, supera el
-- máximo de 3). Confirmar que TAMPOCO quedaron los 2 juegos de TestLoteOk
-- (que por sí sola hubiera estado dentro del máximo):
select count(*) as filas_de_testloteok from games_inscriptions
 where id_inscription = (select id from inscriptions where nombre = 'TestLoteOk');
-- Esperado: 0 — la sentencia completa se revirtió, no solo la parte que fallaba.

-- 17) UPDATE: trasladar una relación existente hacia una inscripción que ya
--     está en su máximo.
--     TestLibreMax3_A ya quedó en 3 juegos (A, B, C) tras las pruebas de arriba.
--     Creamos una inscripción nueva con 1 solo juego y probamos moverle un
--     juego adicional desde otra inscripción vía UPDATE.
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestUpdateOrigen', 'Apellido', '20', '22222227', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_LIBRE_MAX3'));

insert into games_inscriptions (id_inscription, id_game)
values ((select id from inscriptions where nombre = 'TestUpdateOrigen'),
        (select id from games where game_name = 'TEST_GAME_E'));

update games_inscriptions
   set id_inscription = (select id from inscriptions where nombre = 'TestLibreMax3_A')
 where id_inscription = (select id from inscriptions where nombre = 'TestUpdateOrigen')
   and id_game = (select id from games where game_name = 'TEST_GAME_E');
-- Esperado: ERROR: EVENT_GAME_LIMIT_EXCEEDED — TestLibreMax3_A ya tenía 3
-- juegos, el UPDATE la llevaría a 4. Confirmar que la fila NO se movió:
select id_inscription from games_inscriptions
 where id_game = (select id from games where game_name = 'TEST_GAME_E');
-- Esperado: sigue apuntando a TestUpdateOrigen, no a TestLibreMax3_A.

-- 18) UPDATE MULTI-FILA: mover de una sola vez varias relaciones existentes
--     hacia una inscripción que quedaría por encima del máximo. Ejercita
--     específicamente `trg_enforce_event_game_limit_update` con más de una
--     fila afectada por la misma sentencia (no solo el caso de 1 fila del
--     test 17).
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestUpdateMultiOrigen', 'Apellido', '20', '22222228', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_LIBRE_MAX3'));
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestUpdateMultiDestino', 'Apellido', '20', '22222229', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_LIBRE_MAX3'));

-- Origen: 2 juegos. Destino: 2 juegos. Ambos por separado están dentro del
-- máximo (3), pero mover los 2 del origen hacia el destino en un solo UPDATE
-- lo dejaría en 4.
insert into games_inscriptions (id_inscription, id_game)
select (select id from inscriptions where nombre = 'TestUpdateMultiOrigen'), g.id
  from games g where g.game_name in ('TEST_GAME_A', 'TEST_GAME_B');

insert into games_inscriptions (id_inscription, id_game)
select (select id from inscriptions where nombre = 'TestUpdateMultiDestino'), g.id
  from games g where g.game_name in ('TEST_GAME_C', 'TEST_GAME_D');

update games_inscriptions
   set id_inscription = (select id from inscriptions where nombre = 'TestUpdateMultiDestino')
 where id_inscription = (select id from inscriptions where nombre = 'TestUpdateMultiOrigen');
-- Esperado: UPDATE afecta 2 filas en la misma sentencia → ERROR:
-- EVENT_GAME_LIMIT_EXCEEDED (el destino pasaría de 2 a 4). Toda la sentencia
-- se revierte, incluidas las 2 filas — no debe quedar ninguna movida a medias.

select id_inscription, count(*) from games_inscriptions
 where id_game in (select id from games where game_name in ('TEST_GAME_A', 'TEST_GAME_B'))
   and id_inscription in (
       select id from inscriptions where nombre in ('TestUpdateMultiOrigen', 'TestUpdateMultiDestino')
   )
 group by id_inscription;
-- Esperado: las 2 filas siguen apuntando a TestUpdateMultiOrigen (ninguna
-- pasó a TestUpdateMultiDestino).

select count(*) as total_destino from games_inscriptions
 where id_inscription = (select id from inscriptions where nombre = 'TestUpdateMultiDestino');
-- Esperado: 2 (sigue con solo TEST_GAME_C y TEST_GAME_D, sin cambios).

-- ============================================================================
-- CONCURRENCIA — requiere DOS sesiones SQL simultáneas (dos pestañas del SQL
-- Editor, o dos conexiones psql). No alcanza con leer el trigger: hay que
-- ejecutar esto de verdad y observar en qué orden responde cada sesión.
-- ============================================================================

-- Preparación (una sola sesión, antes de abrir la segunda pestaña):
insert into inscriptions (nombre, apellido, edad, celular, localidad, id_evento)
values ('TestConcurrencia', 'Apellido', '20', '33333333', 'Test',
        (select id from events where nombre = 'TEST_EVENTO_LIBRE_MAX3'));
-- Anotar el id resultante (o volver a resolverlo con este SELECT en cada sesión):
select id from inscriptions where nombre = 'TestConcurrencia';

-- La inscripción arranca en 0 juegos, el máximo del evento es 3. Cada
-- transacción, evaluada de forma aislada, intenta agregar 2 juegos (2 <= 3,
-- "parecería" válida por separado) — pero juntas suman 4, por encima del
-- máximo. El lock de la Sección 3 debe impedir que ambas terminen commiteando.

-- --- Sesión A ---------------------------------------------------------------
-- A1) Abrir transacción y agregar 2 juegos, SIN COMMIT todavía:
begin;
insert into games_inscriptions (id_inscription, id_game)
select (select id from inscriptions where nombre = 'TestConcurrencia'), g.id
  from games g where g.game_name in ('TEST_GAME_A', 'TEST_GAME_B');
-- A1 debería devolver INSERT 0 2 sin error (todavía no hay conflicto: el
-- lock de la Sección 3 tomó la fila de `inscriptions`, pero nadie más la pidió aún).

-- --- Sesión B (pestaña/conexión aparte) -------------------------------------
-- B1) Mientras A sigue sin hacer COMMIT, intentar agregar otros 2 juegos a la
--     MISMA inscripción:
begin;
insert into games_inscriptions (id_inscription, id_game)
select (select id from inscriptions where nombre = 'TestConcurrencia'), g.id
  from games g where g.game_name in ('TEST_GAME_C', 'TEST_GAME_D');
-- B1 debe quedar BLOQUEADA (no devuelve resultado todavía) — está esperando
-- el lock de `inscriptions` que sigue tomado por la sesión A.

-- --- Sesión A ---------------------------------------------------------------
-- A2) Confirmar la transacción de A:
commit;
-- En cuanto A hace commit, la sesión B debería desbloquearse sola y terminar
-- de ejecutar su INSERT (que había quedado esperando en B1).

-- --- Sesión B ---------------------------------------------------------------
-- B2) Ver qué pasó apenas se desbloqueó (puede ya haber terminado con error,
--     o haber devuelto el resultado del INSERT si no hubiera habido conflicto):
-- Esperado: ERROR: EVENT_GAME_LIMIT_EXCEEDED — porque recién al poder
-- contar (después del lock), B ve los 2 juegos ya committeados por A más los
-- 2 que intenta agregar = 4, por encima del máximo de 3.
commit; -- (o rollback, si B ya abortó sola por el error — confirmar que no
         -- queda una transacción abierta colgada en esa sesión)

-- Verificación final: la inscripción debe haber quedado con exactamente 2
-- juegos (los de A), nunca con 4 ni con 3.
select count(*) as total_final from games_inscriptions
 where id_inscription = (select id from inscriptions where nombre = 'TestConcurrencia');
-- Esperado: 2.

-- ============================================================================
-- TEARDOWN — borra todo lo creado por este archivo (correr al final)
-- ============================================================================

delete from games_inscriptions
 where id_inscription in (select id from inscriptions where id_evento in (
       select id from events where nombre like 'TEST_EVENTO_%'
   ))
    or id_game in (select id from games where game_name like 'TEST_GAME_%');

delete from inscriptions
 where id_evento in (select id from events where nombre like 'TEST_EVENTO_%');

delete from events where nombre like 'TEST_EVENTO_%';

delete from games where game_name like 'TEST_GAME_%';

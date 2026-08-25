-- Corrige la causa raíz del bug reportado el 2026-07: dos eventos con el mismo
-- slug (mismo lugar + fecha) hacían fallar `events.select('*').eq('slug', ...).single()`
-- con PGRST116 (0 o más de 1 fila), mandando al usuario de vuelta a la Home a mitad
-- del flujo de inscripción.
--
-- IMPORTANTE: este archivo NO se ejecuta solo. Corrida manual en el SQL Editor de
-- Supabase, en este orden:

-- 1) Detectar si hay slugs duplicados ANTES de agregar la restricción.
--    Si esto devuelve filas, hay que resolverlas (ver paso 2) antes del paso 3.
select slug, count(*) as cantidad
from events
group by slug
having count(*) > 1;

-- 2) Inspeccionar los registros afectados por cada slug duplicado que haya
--    aparecido en el paso 1 (reemplazar 'EL-SLUG-DUPLICADO' por cada uno).
--    Sirve para decidir cuál de las filas conservar y cuál eliminar/renombrar,
--    revisando si alguna tiene inscripciones asociadas (no conviene borrar esa).
select e.*,
       exists (
           select 1 from inscriptions i where i.id_evento = e.id
       ) as tiene_inscripciones
from events e
where e.slug = 'EL-SLUG-DUPLICADO'
order by e.created_at;

-- 3) Una vez resueltos todos los duplicados (borrando o renombrando el slug de
--    las filas sobrantes), agregar la restricción de unicidad definitiva.
--    Esta es la protección real contra condiciones de carrera: el chequeo que
--    hace el frontend antes de insertar (ver AddTournamentForm.jsx) es best-effort,
--    esto es lo que garantiza que nunca más pueda quedar un slug repetido.
alter table events add constraint events_slug_unique unique (slug);

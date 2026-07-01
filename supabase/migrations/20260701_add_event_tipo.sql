-- Tipo de evento: torneo (default) o presentacion
alter table events add column tipo text not null default 'torneo'
  check (tipo in ('torneo', 'presentacion'));

-- Si el evento no debe listarse en la home (presentaciones por defecto no se listan)
alter table events add column visible_en_home boolean not null default true;

-- Fecha/hora límite opcional para cierre automático de inscripción
alter table events add column fecha_cierre_inscripcion timestamptz;

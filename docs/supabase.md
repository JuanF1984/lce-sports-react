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

### `games`

`id, game_name, team_option, principal, active`. `useGames` sólo trae `active = true`.

### `event_games`

`id, event_id (FK events.id), game_id (FK games.id)`.

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

-- Políticas de Supabase Storage para el bucket `juegos` (imágenes de
-- catálogo de videojuegos, administración desde el panel admin — Etapa 1,
-- ver docs/games.md). Mismo patrón que
-- supabase/migrations/20260810_gallery_storage_policies.sql para el bucket
-- `galeria`.
--
-- ESTE ARCHIVO NO CREA EL BUCKET. No hay forma de confirmar desde este repo
-- si el bucket `juegos` ya existe o está configurado como público.
--
-- PASO MANUAL PREVIO Y OBLIGATORIO (hacer ANTES de correr este archivo):
--   1. Dashboard de Supabase → Storage → "New bucket".
--   2. Nombre EXACTO: `juegos` — el código llama
--      `supabase.storage.from('juegos')`
--      (src/components/pages/dashboardAdmin/games/GamesList.jsx). Un nombre
--      distinto rompe el upload/delete/lectura sin ningún error de SQL de
--      por medio.
--   3. Marcarlo como "Public bucket" (lectura pública) — necesario para que
--      `getPublicUrl(image_path)` sirva la imagen sin autenticación cuando
--      se conecte al flujo público en la etapa 2 (en esta etapa 1 la imagen
--      solo se ve dentro del panel admin, pero conviene dejar la
--      configuración de Storage lista desde ahora, igual que se hizo con
--      `galeria`).
--
-- SUPUESTO NO VERIFICABLE DESDE ESTE REPO: que RLS ya está habilitado sobre
-- `storage.objects` a nivel de proyecto (comportamiento por defecto de
-- Supabase Storage — no se agrega ningún `alter table ... enable row level
-- security` acá, mismo criterio que el archivo equivalente de `galeria`).
--
-- SUPUESTO NO VERIFICABLE DESDE ESTE REPO: que `is_admin()` existe y es
-- invocable desde una policy de `storage.objects`. Verificar antes de
-- correr:
--     select proname from pg_proc where proname = 'is_admin';
--
-- CÓMO CORRER: SQL Editor de Supabase, DESPUÉS de crear el bucket a mano.

begin;

-- Lectura pública de cualquier objeto del bucket `juegos`.
drop policy if exists games_objects_select_public on storage.objects;
create policy games_objects_select_public
    on storage.objects
    for select
    using (bucket_id = 'juegos');

-- Alta de archivos (alta de juego nuevo, o carga de imagen para uno
-- existente que todavía no tenía) solo admin.
drop policy if exists games_objects_insert_admin on storage.objects;
create policy games_objects_insert_admin
    on storage.objects
    for insert
    with check (bucket_id = 'juegos' and is_admin());

-- El flujo de reemplazo de esta etapa nunca hace UPDATE sobre un objeto
-- existente (siempre sube un path nuevo y borra el viejo aparte, ver
-- GamesList.jsx) — esta policy no la usa el código actual, se agrega de
-- todas formas por si algún día hace falta un UPDATE real sobre
-- storage.objects (mismo criterio de "cubrir la operación aunque el
-- frontend hoy no la use" que ya aplicó
-- trg_enforce_event_game_limit_update en
-- 20260804_event_participation_rules.sql).
drop policy if exists games_objects_update_admin on storage.objects;
create policy games_objects_update_admin
    on storage.objects
    for update
    using (bucket_id = 'juegos' and is_admin())
    with check (bucket_id = 'juegos' and is_admin());

-- Borrado de la imagen anterior tras un reemplazo exitoso, solo admin.
drop policy if exists games_objects_delete_admin on storage.objects;
create policy games_objects_delete_admin
    on storage.objects
    for delete
    using (bucket_id = 'juegos' and is_admin());

commit;

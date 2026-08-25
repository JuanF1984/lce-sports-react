-- Políticas de Supabase Storage para el bucket `galeria` (Galería de
-- imágenes del carrusel público, ver docs/galeria.md y
-- 20260810_gallery_items.sql).
--
-- ESTE ARCHIVO NO CREA EL BUCKET. La creación de un bucket de Storage no es
-- algo que este repo pueda versionar como una migración de tabla común, y no
-- hay forma de confirmar desde acá si el bucket `galeria` ya existe o está
-- configurado como público. Ver docs/galeria.md, sección "Pasos manuales en
-- Supabase", para el detalle completo.
--
-- PASO MANUAL PREVIO Y OBLIGATORIO (hacer ANTES de correr este archivo):
--   1. Dashboard de Supabase → Storage → "New bucket".
--   2. Nombre EXACTO: `galeria` — el código llama
--      `supabase.storage.from('galeria')`
--      (src/components/pages/dashboardAdmin/gallery/GalleryList.jsx). Un
--      nombre distinto rompe el upload/delete/lectura sin ningún error de
--      SQL de por medio (el bucket simplemente "no existe" para ese nombre).
--   3. Marcarlo como "Public bucket" (lectura pública) — necesario para que
--      `getPublicUrl(image_path)` devuelva una URL servible sin
--      autenticación (así es como el carrusel público va a mostrar las
--      imágenes en la etapa 2, y es el mismo criterio que ya usa el bucket
--      `eventos`).
--
-- SUPUESTO NO VERIFICABLE DESDE ESTE REPO: que RLS ya está habilitado sobre
-- `storage.objects` a nivel de proyecto (es el comportamiento por defecto de
-- Supabase Storage, así que no se agrega ningún `alter table ... enable row
-- level security` acá — si por algún motivo NO estuviera habilitado en esta
-- instancia particular, hay que habilitarlo a mano antes de que estas
-- policies tengan efecto).
--
-- SUPUESTO NO VERIFICABLE DESDE ESTE REPO: que la función `is_admin()` existe
-- y es invocable desde una policy de `storage.objects` igual que desde una
-- policy de tabla común (mismo aviso que en 20260810_gallery_items.sql).
-- Verificar antes de correr:
--     select proname from pg_proc where proname = 'is_admin';
--
-- CÓMO CORRER: SQL Editor de Supabase, DESPUÉS de crear el bucket a mano
-- (paso manual de arriba). Corre dentro de una transacción explícita.

begin;

-- Lectura pública de cualquier objeto del bucket `galeria` — necesario para
-- que el carrusel público (etapa 2) pueda mostrar las imágenes sin login, y
-- para que `getPublicUrl()` sirva un archivo que además tiene su URL
-- protegida por policy (en Supabase, un bucket "público" más una policy de
-- SELECT restrictiva puede terminar bloqueando igual la lectura vía URL
-- pública según la configuración exacta del proyecto — motivo extra para
-- verificar manualmente el resultado final, ver docs/galeria.md).
drop policy if exists gallery_objects_select_public on storage.objects;
create policy gallery_objects_select_public
    on storage.objects
    for select
    using (bucket_id = 'galeria');

-- Alta y borrado de archivos solo para admin. No se agrega policy de UPDATE:
-- el flujo de esta etapa nunca reemplaza el archivo de un `gallery_items`
-- existente (ver docs/galeria.md, "Edición" — para cambiar la foto hay que
-- borrar la entrada y crear una nueva), así que no hace falta permitir
-- `update` sobre `storage.objects` para este bucket.
drop policy if exists gallery_objects_insert_admin on storage.objects;
create policy gallery_objects_insert_admin
    on storage.objects
    for insert
    with check (bucket_id = 'galeria' and is_admin());

drop policy if exists gallery_objects_delete_admin on storage.objects;
create policy gallery_objects_delete_admin
    on storage.objects
    for delete
    using (bucket_id = 'galeria' and is_admin());

commit;

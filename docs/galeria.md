# Carrusel / Galería de imágenes

Este documento cubre el carrusel de imágenes+texto de la Home (sección "MEGAEVENTO", debajo de
"Próximo evento") y su administración desde el panel admin, sección "Galería" — implementada en
dos etapas: etapa 1 (CRUD admin de `gallery_items` + Storage) y etapa 2 (el carrusel público pasó a
leer de esa tabla en vez de datos hardcodeados). Ambas etapas están implementadas; ver los índices
de cada sección más abajo.

No existía documentación previa de este carrusel en `docs/` — este archivo es nuevo, no reemplaza
ni duplica `docs/eventos.md` (que documenta `events.imagen_url`, el banner de un evento puntual en
"Próximo evento", un dato **distinto** y no relacionado con este carrusel).

## Estado original, previo a esta feature (histórico)

Sección conservada como referencia histórica de cómo funcionaba el carrusel **antes** de las
etapas 1 y 2 de esta feature — el hardcodeo que describe ya no está vigente (ver "Implementado en
etapa 2" más abajo para el estado real actual).

### Archivos involucrados

- `src/components/layout/main/Main.jsx` — dueño de los datos: define `textImageItems` (array
  hardcodeado de `{ title, description, image }`) y renderiza `<CarruselTextAndImage>`.
- `src/components/common/carrusel/carruselTextAndImages/CarruselTextAndImage.jsx` — arma un slide
  (`<img>` + `<h4>title</h4>` + `<p>description</p>`) por cada item y se lo pasa a `CarruselCommon`.
- `src/components/common/carrusel/carruselCommon/CarruselCommon.jsx` — el carrusel genérico en sí:
  envuelve `swiper/react` (librería `swiper`, ya en `package.json`) con autoplay, paginación,
  navegación y un modal de imagen ampliada.
- `src/components/common/carrusel/carruselCommon/CarruselCommonModal.jsx` — modal que se abre al
  clickear un slide (navegación con flechas del teclado y `Escape`).
- `src/components/common/carrusel/carruselCommon/CarruselStyle.css` — estilos de ambos (carrusel +
  modal).
- `src/assets/img/torneos/*.webp` — los 5 archivos de imagen, importados como módulos ES
  (`import brandsenImg from '@img/torneos/brandsen.webp'`, etc.).

**Componente no usado / código muerto relacionado**: `CarruselImages.jsx` (mismo directorio,
variante "solo imágenes sin texto") no se importa desde ningún lado del código — no está montado
en ninguna pantalla. `Main.jsx` además mantiene un `useEffect` que carga por `import.meta.glob(...)`
todas las imágenes de `src/assets/img/carrousel-buscate/*` en un estado `images`, pero ese estado
nunca se pasa a ningún componente ni se renderiza — es una segunda pieza de código muerto. Ninguno
de los dos se toca en esta etapa (solo relevamiento), se documentan porque una futura limpieza
podría querer eliminarlos.

### Origen de las imágenes y los textos (hardcodeo) — ELIMINADO en etapa 2

Este array **ya no existe en el código** (`Main.jsx` lo reemplazó en etapa 2 por
`useGalleryItems()`, ver más abajo) — se conserva acá únicamente como referencia histórica de cómo
estaba antes:

```js
const textImageItems = [
  { title: 'Brandsen', description: 'Fecha del torneo: 12 de octubre de 2024', image: brandsenImg },
  { title: 'Colón', description: 'Fecha del torneo: 28 de septiembre de 2024', image: colonImg },
  { title: 'Hurlingham', description: 'Fecha del torneo: 4 de mayo de 2024', image: hurlinghamImg },
  { title: 'La Plata', description: 'Fecha del torneo: 21 de septiembre de 2024', image: laPlataImg },
  { title: 'San Andrés de Giles', description: 'Fecha del torneo: 27 de julio de 2024', image: sanAndresDeGilesImg },
];
```

En su momento no había ninguna consulta a Supabase involucrada — ni las imágenes ni los textos
salían de la base, y cambiar el contenido requería un deploy. Desde etapa 2, el contenido se
administra desde el panel Galería sin necesidad de deploy — ver "Implementado en etapa 2" más
abajo.

### Funcionamiento técnico

- `CarruselCommon` recibe `items` (array de nodos JSX ya armados) + `title` + `id`.
- Si `items.length < 8`, los cuadruplica (`[...items, ...items, ...items, ...items]`) — truco para
  que el `loop` de Swiper (que exige suficientes slides) no se vea pobre con pocos ítems. Con 5
  ítems hardcodeados hoy, terminan siendo 20 slides reales en el DOM.
- Swiper: `slidesPerView` responsive (1 / 2 / 3 / 4 según breakpoints 0/640/768/1024px),
  `centeredSlides`, `autoplay` (delay 1500ms, no se detiene por interacción salvo al abrir el
  modal), `pagination` con bullets clickeables, `navigation` (flechas), `loop` solo si
  `items.length >= 4` (evalúa sobre el array ya multiplicado).
- Click en un slide → abre `CarruselCommonModal` mostrando ese mismo nodo JSX en grande, con
  navegación por flechas del teclado / `Escape`, y pausa el autoplay mientras está abierto.
- `onImageLoad` se propaga hasta el `<img>` de cada slide y se usa en `Main.jsx` vía
  `useImageLoading` para saber cuándo terminó de cargar visualmente el carrusel (gate del
  loader de la Home, junto con el hero de `ProximoEvento`).

### Estructura actual del objeto de un item

```ts
{ title: string, description: string, image: (import de asset) }
```

## Implementado en etapa 1 (CRUD admin — carrusel público SIN CAMBIOS)

Esta etapa deja administrable la tabla `gallery_items` desde un panel nuevo (`Galería`) en el
dashboard admin. **El carrusel público de la Home sigue mostrando el array hardcodeado de
`Main.jsx` tal cual estaba** — `Main.jsx`, `CarruselTextAndImage.jsx` y `CarruselCommon.jsx` no se
tocaron en esta etapa. Ver "Pendiente etapa 2" más abajo para lo que falta para conectar ambas
puntas.

### Tabla `gallery_items`

Migración `supabase/migrations/20260810_gallery_items.sql` (no se aplicó desde este entorno —
correrla a mano en el SQL Editor de Supabase, ver "Pasos manuales" más abajo). Estructura:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint generated by default as identity` | PK. Elegido por ser el default de Supabase para tablas nuevas — no hay ninguna migración de creación de tabla versionada en este repo para `events`/`inscriptions` que permita confirmar qué tipo de PK usan esas tablas, así que esto es una decisión razonada, no una confirmación. |
| `image_path` | `text not null` | Path real del archivo en el bucket `galeria` (no la URL pública completa — se deriva en runtime con `getPublicUrl`). |
| `title` | `text not null default ''` | Texto libre, sin significado fijo. |
| `subtitle` | `text not null default ''` | Texto libre, sin significado fijo. |
| `sort_order` | `integer not null` | Posición en el carrusel; sin `UNIQUE` (ver comentario en la migración — el frontend evita duplicados en el flujo normal, agregar la restricción sumaría manejo de errores sin necesidad real a 15 filas máximo). |
| `created_at` | `timestamptz not null default now()` | |

Sin FK a `events`, sin `localidad`/`fecha`/`is_visible` — la unidad es una foto independiente, tal
como se definió en el relevamiento previo.

### Límite de 15 — protección en tres niveles

1. **UI** (`GalleryList.jsx`): muestra `X / 15 imágenes utilizadas`; con 15 cargadas, deshabilita
   el input de archivo, los campos de texto y el botón "Agregar imagen", y muestra el mensaje "Se
   alcanzó el máximo de 15 imágenes. Eliminá una imagen antes de agregar otra."
2. **Aplicación** (`GalleryList.jsx` → `handleAdd`): antes de subir nada a Storage, chequea
   `galleryItems.length >= 15` contra el state ya cargado — evita gastar un upload si ya se sabe
   que va a fallar.
3. **Base de datos** (definitivo): trigger `trg_enforce_gallery_items_limit`
   (`BEFORE INSERT ON gallery_items FOR EACH ROW`, función `enforce_gallery_items_limit()`), en la
   migración de arriba. Cuenta las filas existentes y rechaza con el marcador
   `GALLERY_ITEMS_LIMIT_EXCEEDED` (errcode custom `LCE06`, continúa la numeración `LCE01`-`LCE05`
   ya usada en `20260804_event_participation_rules.sql`) si ya hay 15. Toma
   `lock table gallery_items in share row exclusive mode` al principio del trigger para serializar
   altas concurrentes (dos inserts al mismo tiempo no pueden ambos leer "14" y colarse) — no
   probado contra una instancia real con dos sesiones simultáneas, análisis estático únicamente
   (mismo tipo de aviso que ya deja la migración de reglas de participación para su propio
   mecanismo de concurrencia).

El frontend traduce ese marcador a mensaje de usuario con `mapGalleryRuleError`
(`src/utils/galleryRules.js`), mismo patrón que `mapSupabaseRuleError` en `src/utils/eventRules.js`.

### Storage: bucket `galeria`

El código llama `supabase.storage.from('galeria')` — **bucket independiente, no se reutiliza
`eventos`** (decisión explícita de esta etapa). Se guarda `image_path` (ej.
`1723315200000-foto.webp`), nunca la URL pública; la URL se obtiene en runtime con
`supabase.storage.from('galeria').getPublicUrl(image_path)`. Paths únicos vía
`${Date.now()}-${nombreSaneado}`, mismo criterio de saneo de nombre que ya usan
`AddTournamentForm.jsx` y `EmailMasivo.jsx` (espacios → `_`, resto no alfanumérico eliminado). Sin
`upsert: true` — cada alta es un archivo nuevo, nunca se pisa un path existente.

**El bucket `galeria` NO fue creado desde este repo — no se puede crear un bucket de Storage desde
una migración SQL común, y su existencia/configuración no es verificable desde acá.** Ver "Pasos
manuales" más abajo.

### Alta

`GalleryList.jsx` → `handleAdd`:
1. Valida cantidad `< 15` contra el state local.
2. Valida el archivo en JavaScript (no solo `accept` del input): MIME en
   `['image/jpeg', 'image/jpg', 'image/png', 'image/webp']` y tamaño `<= 5 MB`. Si no cumple, no
   sube nada y muestra un mensaje claro.
3. `supabase.storage.from('galeria').upload(path, file, { upsert: false, contentType: file.type })`.
4. Si el upload funciona, `insert` en `gallery_items` con `image_path`, `title`, `subtitle` y
   `sort_order = max(sort_order existente) + 1` (o `0` si la galería está vacía) — queda al final
   de la lista.
5. Si el `insert` falla después de haber subido el archivo, se intenta `storage.remove([path])`
   (best-effort, con `catch`/log si también falla) antes de mostrar el error — evita dejar el
   archivo huérfano cuando se puede.

### Edición

Solo `title` y `subtitle` (`update` directo por `id`). **No se permite reemplazar la imagen en
esta etapa** — para cambiar la foto hay que eliminar la entrada y crear una nueva (decisión
explícita, evita inconsistencias con Storage y mantiene el flujo simple).

### Eliminación y limpieza de Storage

Orden elegido — **DB primero, Storage después** (no al revés): si el archivo quedara borrado pero
la fila no, el carrusel público mostraría una imagen rota (más visible y peor que un archivo
huérfano silencioso).

1. Se conserva `image_path` en memoria antes de borrar.
2. `delete` de la fila en `gallery_items`.
3. Si el DELETE falla: no se toca Storage, se muestra el error, la fila (y el archivo) siguen
   existiendo tal cual estaban.
4. Si el DELETE funciona: se actualiza la UI y se renumera `sort_order` de las filas restantes de
   forma secuencial (`0..n-1`) para no dejar huecos — solo se hace `update` de las filas cuyo
   `sort_order` realmente cambió.
5. Se intenta `storage.remove([image_path])` (best-effort). Si falla, **no se restaura la fila**
   (ya no existe y no tiene sentido revivirla): se loguea el error en consola y se le informa al
   admin en pantalla que la imagen se eliminó de la galería pero puede haber quedado un archivo
   pendiente de limpieza manual en Storage.

### Orden

`sort_order` + botones "↑"/"↓" en cada fila (sin drag & drop, según lo pedido). Subir/bajar
intercambia el `sort_order` entre la fila y su vecina inmediata en la lista ya ordenada. El primer
ítem no puede subir (botón deshabilitado) y el último no puede bajar. Si la segunda mitad de un
intercambio fallara justo después de que la primera ya se aplicó (caída de red a mitad de camino),
podrían quedar dos filas con el mismo `sort_order` hasta la próxima recarga — caso borde conocido,
no se agregó un mecanismo de rollback para esto (tabla chica, pensada para que la use un admin a la
vez, no una operación de alto tráfico).

### Vista `Galería` en el dashboard admin

`DashboardAdmin.jsx` suma un botón "Galería" al mismo `<aside>` que ya tiene "Listar Inscripciones"
/ "Listar Eventos" / "Email Masivo" / "Emails Inválidos", con el mismo patrón de `view` state que
ya usaban las otras cuatro secciones. Componente nuevo:
`src/components/pages/dashboardAdmin/gallery/GalleryList.jsx` — reutiliza las clases CSS ya
existentes en `src/styles/InscriptionsList.css` (`.inscriptions-container`, `.titulos-admin`,
`.table-wrapper`, `.inscriptions-table`, `.export-button`, `.cancel-button`,
`.success-message-admin`/`.error-message-admin`, `.filter-group`/`.filter-label`/`.filter-select`,
`.email-masivo-file-input`/`.email-masivo-imagen-preview`) más un puñado de clases nuevas
específicas de la galería (`.gallery-counter`, `.gallery-add-panel`, `.gallery-thumb`,
`.gallery-order-btn`, `.gallery-row-actions`), agregadas al final de ese mismo archivo CSS
compartido — no se creó ningún archivo `.css` nuevo ni se agregó ninguna librería de UI. Muestra,
por fila: miniatura, título, subtítulo, posición (botones ↑/↓), y acciones (Editar/Eliminar).

### Seguridad / RLS

RLS habilitado en `gallery_items` desde la propia migración (`20260810_gallery_items.sql`):
`SELECT` público (`using (true)`), `INSERT`/`UPDATE`/`DELETE` solo si `is_admin()` devuelve
`true`. Los escritura desde el frontend se hace directo con `supabase.from('gallery_items')...`
(cliente `anon key` + sesión del admin logueado) — **mismo patrón que ya usa `EventsList.jsx` para
`events`/`event_games`**, no a través de una API route con `service_role key`.

**Sobre `is_admin()`**: la migración la reutiliza tal cual, sin redefinirla. Su existencia **no
está versionada como migración en este repo** — la única referencia es
`claude/commands/fix-rls-api-admin.md`, que documenta haberla probado contra la sesión de un admin
real (impersonate en el SQL Editor) pero no incluye su definición SQL. Antes de correr la
migración, confirmar `select proname from pg_proc where proname = 'is_admin';` en el SQL Editor. Si
no existe, la migración falla en el `create policy` con "function is_admin() does not exist" —
resolver eso primero, no asumirla.

**Nota heredada del resto del proyecto** (no es una regresión introducida acá): la protección de
`/inscriptions` en el cliente (`DashboardAdmin.jsx`) hoy solo valida "¿hay una sesión de Supabase
logueada?" (`AuthProvider.jsx`), no `role === 'admin'`. La sección Galería hereda esa misma
característica — la barrera real de "solo admin puede escribir" queda del lado de RLS
(`is_admin()`), no del cliente.

### Storage: policies de `storage.objects`

Migración separada `supabase/migrations/20260810_gallery_storage_policies.sql` (independiente de
la de la tabla, porque requiere que el bucket ya exista — ver "Pasos manuales"): lectura pública de
cualquier objeto con `bucket_id = 'galeria'`, `insert`/`delete` solo si `is_admin()`. No se agrega
policy de `update` — el flujo de esta etapa nunca reemplaza el archivo de un ítem existente.

## Pasos manuales en Supabase (obligatorios, no aplicados desde este repo)

Nada de esto se pudo ejecutar ni confirmar desde este entorno — es una lista de lo que hay que
hacer/verificar a mano:

1. **Correr `supabase/migrations/20260810_gallery_items.sql`** en el SQL Editor de Supabase.
   Antes, confirmar que existe `is_admin()`:
   `select proname from pg_proc where proname = 'is_admin';` — si no aparece, resolver eso primero
   (la migración va a fallar en la Sección 3 si no existe).
2. **Crear el bucket `galeria`** en Dashboard de Supabase → Storage → "New bucket". Nombre EXACTO
   `galeria` (el código usa `.storage.from('galeria')`, un nombre distinto rompe todo en
   silencio, sin error de SQL). Marcarlo como **público** (lectura pública) — igual que ya está
   configurado (asumido, no confirmable desde acá) el bucket `eventos`.
3. **Correr `supabase/migrations/20260810_gallery_storage_policies.sql`**, DESPUÉS de crear el
   bucket del paso 2.
4. **Confirmar el resultado real de lectura pública**: subir una imagen de prueba desde el panel
   Galería y verificar que la URL que devuelve `getPublicUrl()` carga la imagen en una pestaña
   nueva sin estar logueado — la combinación de "bucket público" + policies de `storage.objects`
   puede comportarse distinto según configuración exacta del proyecto, no se puede dar por hecho
   solo por haber corrido el SQL.
5. **Probar el flujo completo con un usuario admin real**: agregar una imagen, editar
   título/subtítulo, subir/bajar orden, eliminar una imagen y confirmar en el Storage del dashboard
   que el archivo efectivamente desaparece.
6. **Probar el límite de 15** con datos de prueba: cargar 15 imágenes y confirmar que la 16ª
   intenta fallar tanto por UI (botón deshabilitado) como, si se fuerza una request directa
   saltenado el frontend, por el trigger (`GALLERY_ITEMS_LIMIT_EXCEEDED`).
7. **Confirmar el tipo de PK real** una vez creada la tabla, si querés verificar que
   `bigint generated by default as identity` es coherente con el resto del esquema:
   `select column_name, data_type from information_schema.columns where table_name =
   'gallery_items' and column_name = 'id';`.

## Implementado en etapa 2 (carrusel público conectado a `gallery_items`)

`Main.jsx` deja de usar el array hardcodeado `textImageItems` — la fuente real ahora es la tabla
`gallery_items`. **`CarruselTextAndImage.jsx` y `CarruselCommon.jsx` no se tocaron**: no hizo falta,
siguen recibiendo exactamente la misma forma de objeto que ya consumían
(`{ title, description, image }`), así que Swiper, autoplay, navegación, paginación, responsive, el
modal al hacer click y el truco de cuadruplicar slides cuando hay pocos ítems (`items.length < 8`)
quedan intactos sin ningún cambio de código en esos dos archivos.

### Cómo obtiene Home los registros

`Main.jsx` llama al mismo hook que ya usa el admin, `useGalleryItems()`
(`src/hooks/useGalleryItems.jsx` — **sin cambios**, se reutiliza tal cual). La query ya ordena
`.order('sort_order', { ascending: true })`, así que el orden que ve el público es exactamente el
que definió el admin — no se reordena por `id`, `created_at` ni ningún otro criterio en `Main.jsx`.

### Conversión a la forma que espera el carrusel

```js
const textImageItems = (galleryItems || []).map(item => ({
  title: item.title,
  description: item.subtitle,
  image: getGalleryPublicUrl(item.image_path),
}));
```

`getGalleryPublicUrl` es un helper local de `Main.jsx` (`supabase.storage.from('galeria')
.getPublicUrl(imagePath).data.publicUrl`) — misma lógica que ya usa `GalleryList.jsx` en el admin,
duplicada intencionalmente en vez de importarla desde ahí (son dos puntas distintas del código,
público vs. admin, y es una función de una línea — no ameritaba una abstracción compartida nueva
para esto). La URL pública se calcula siempre en runtime a partir de `image_path`; en ningún
momento se persiste ni se cachea una URL en base de datos.

### Loading / error / galería vacía

- **Loading**: mientras `useGalleryItems()` no terminó (`galleryLoading === true`),
  `galleryItems` es `null` → `textImageItems` es `[]` → la sección del carrusel simplemente no se
  renderiza todavía (no hay skeleton, no rompe el layout — el resto de la Home, `ProximoEvento` y
  `RedesSociales`, no depende de esto).
- **Error**: si la consulta falla, `galleryError` queda seteado y `galleryItems` se queda en
  `null` (mismo comportamiento que ya tenía el hook para el admin) — se loguea con `console.error`
  en un `useEffect` (para que quede rastreable, mismo criterio que ya usa
  `SeleccionInscripcion.jsx` antes de sus redirects silenciosos) y, como `textImageItems` termina
  vacío igual que en el caso de loading, el carrusel no se renderiza. No hay ningún error sin
  controlar que llegue a la consola del navegador como excepción no atrapada, y el resto de la Home
  sigue funcionando con normalidad.
- **Galería vacía** (`gallery_items` con 0 filas): mismo camino que el error — `textImageItems`
  vacío, no se renderiza `<CarruselTextAndImage>` ni sus controles (nada de paginación/flechas
  "inútiles" sobre cero slides). **No hay fallback a las imágenes hardcodeadas**: una vez esta
  etapa está andando, la única fuente es Supabase, tal como se pidió.

### Por qué no se rompe el loader global de la Home

`App.jsx` mantiene la Home tapada con `<LogoNeon />` hasta que `Main.jsx` llama a
`onLoadComplete` (ver `handleMainLoad`), y `Main.jsx` solo llama a eso cuando
`heroLoaded && !carouselLoading`. `carouselLoading` viene de `useImageLoading()`, que por diseño
(`imageCount` default `1`) se pone en `false` recién cuando se dispara al menos un `onLoad` de
`<img>`. Con el array hardcodeado esto nunca fallaba porque siempre había 5 imágenes locales. Con
`gallery_items`, si la consulta devuelve 0 filas o falla, **no se renderiza ninguna `<img>` del
carrusel** — sin nada más, `carouselLoading` se hubiera quedado en `true` para siempre y la Home
entera hubiera quedado trabada en el loader. Se agregó un `useEffect` puntual en `Main.jsx` que
llama a `handleImageLoad()` manualmente apenas la consulta de galería termina (`!galleryLoading`) y
no hay nada para mostrar (`!hayImagenesDeGaleria`) — simula "ya terminé de cargar" cuando
efectivamente no hay ninguna imagen que cargar. No se tocó `useImageLoading.jsx` (hook genérico,
sin otro consumidor en el código, pero no forma parte de "el carrusel" en sí — se resolvió el caso
borde enteramente desde `Main.jsx`).

### Archivos modificados en esta etapa

Solo `src/components/layout/main/Main.jsx`. Se quitaron los 5 imports de
`src/assets/img/torneos/*.webp` (`brandsenImg`, `colonImg`, `hurlinghamImg`, `laPlataImg`,
`sanAndresDeGilesImg`) y el array hardcodeado `textImageItems` original — el `build` de Vite ya no
empaqueta esos 5 `.webp` (confirmado comparando la lista de assets del build antes/después de este
cambio). **Los archivos `.webp` en sí no se borraron del disco** — solo se quitaron los imports que
los usaban; borrar los archivos físicos queda fuera de alcance de esta etapa (no se pidió, y
mezclaría "código muerto por este cambio" con una limpieza de assets más general).
`CarruselTextAndImage.jsx` y `CarruselCommon.jsx`: sin cambios.

### Código muerto — sin cambios respecto a etapa 1

`CarruselImages.jsx` y el `useEffect`/state `images` de `Main.jsx` (carga de
`carrousel-buscate/*`) **siguen intactos y siguen sin usarse** — ya estaban muertos antes de esta
etapa (no dejaron de usarse "como consecuencia" de este cambio, ya no se usaban desde antes), así
que no se tocaron, según lo pedido explícitamente. Sigue pendiente una futura limpieza general que
está fuera de alcance de ambas etapas de esta feature.

## Errores y casos borde conocidos (etapa 1)

- **Condición de carrera en subir/bajar orden**: si la segunda mitad de un intercambio de
  `sort_order` falla después de que la primera ya se aplicó, pueden quedar dos filas con el mismo
  valor hasta la próxima recarga de la página (no hay rollback automático).
- **Archivo huérfano si falla el `remove` al eliminar**: la fila se borra igual (prioridad: que el
  sitio nunca apunte a una imagen inexistente), y se le avisa al admin en pantalla — la limpieza
  del archivo en Storage queda pendiente de revisión manual en ese caso puntual.
- **`is_admin()` no versionada en este repo**: si no existe en la base real, la migración de la
  tabla falla al crear las policies (ver "Pasos manuales", punto 1).
- **Bucket con nombre distinto a `galeria`**: rompe upload/delete/lectura sin ningún error de SQL
  de por medio — el bucket "no existe" para ese nombre.
- **RLS de `gallery_items`/`storage.objects` no confirmable como aplicada** hasta que un admin real
  lo pruebe contra la instancia (ver "Pasos manuales", puntos 4 y 5) — el código asume que las
  policies quedaron como se escribieron, pero eso no se puede verificar desde este entorno.

## Errores y casos borde conocidos (etapa 2)

- **Si el bucket `galeria` no quedó configurado como público** (o las policies de lectura de
  `storage.objects` no se aplicaron), `getGalleryPublicUrl()` igual devuelve una URL con la forma
  correcta, pero esa URL no va a cargar la imagen — el carrusel público renderizaría slides con
  `<img>` rotas en vez de directamente no mostrar nada. Este caso no se puede probar desde este
  entorno (depende de la configuración real del bucket) — parte de la verificación manual pendiente
  ya listada en "Pasos manuales en Supabase", punto 4.
- **Imágenes servidas desde Storage en vez de assets bundleados**: antes, las 5 imágenes del
  carrusel viajaban con el build (carga casi instantánea); ahora dependen de una request de red al
  bucket público de Supabase en cada visita a la Home. `carouselLoading` sigue esperando el primer
  `onLoad` real de esas imágenes (no se agregó ningún timeout ni skeleton, tal como se pidió
  explícitamente para esta etapa) — con una red lenta, la Home puede tardar visiblemente más en
  ocultar el `<LogoNeon />` que antes. No se optimizó (compresión, `srcset`, lazy loading) porque no
  formaba parte del alcance pedido.
- **Título "MEGAEVENTO" también desaparece cuando la galería está vacía o falla**: el `<h2>` del
  carrusel vive dentro de `CarruselCommon.jsx`, que ahora no se monta si `textImageItems` está
  vacío — es intencional (no mostrar controles/encabezado de una sección sin contenido), pero vale
  aclarar que no es solo el carrusel el que desaparece, es toda la sección "MEGAEVENTO".
- **`gallery_items` recién creada empieza vacía**: hasta que un admin cargue al menos una imagen
  desde el panel Galería, la sección completa del carrusel no aparece en la Home — comportamiento
  esperado según lo pedido ("no volver automáticamente a las imágenes hardcodeadas"), pero es
  importante que quede claro antes de dar por "terminada" esta etapa en producción: cargar
  contenido real en `gallery_items` es un paso operativo pendiente, no un bug.

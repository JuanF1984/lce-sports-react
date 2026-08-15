import { useRef, useState } from 'react';
import supabase from '../../../../utils/supabase';
import { useGalleryItems } from '../../../../hooks/useGalleryItems';
import { GALLERY_MAX_ITEMS, mapGalleryRuleError } from '../../../../utils/galleryRules';
import { optimizeImage, ImageOptimizationError } from '../../../../utils/optimizeImage';

const STORAGE_BUCKET = 'galeria';

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const getPublicUrl = (path) =>
    supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;

// Sanea el nombre de archivo antes de armar el path — mismo criterio que ya
// usan AddTournamentForm.jsx y EmailMasivo.jsx para sus propios uploads.
const sanitizeFileName = (name) =>
    name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');

export const GalleryList = () => {
    const { galleryItems, galleryError, galleryLoading, setGalleryItems } = useGalleryItems();

    const [message, setMessage] = useState({ type: '', text: '' });
    const showMessage = (type, text, timeout = 4000) => {
        setMessage({ type, text });
        if (timeout) setTimeout(() => setMessage({ type: '', text: '' }), timeout);
    };

    // ── Alta ─────────────────────────────────────────────
    const fileInputRef = useRef(null);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [errorImagen, setErrorImagen] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newSubtitle, setNewSubtitle] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const alcanzoElLimite = (galleryItems?.length ?? 0) >= GALLERY_MAX_ITEMS;

    const resetFormAlta = () => {
        setImageFile(null);
        setImagePreview('');
        setNewTitle('');
        setNewSubtitle('');
        setErrorImagen('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setErrorImagen('');

        if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
            setErrorImagen('Formato no permitido. Subí una imagen JPG, PNG o WebP.');
            setImageFile(null);
            setImagePreview('');
            e.target.value = '';
            return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            setErrorImagen('El archivo supera el tamaño máximo permitido (5 MB).');
            setImageFile(null);
            setImagePreview('');
            e.target.value = '';
            return;
        }

        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (submitting) return;

        // 1. Cantidad actual, antes de tocar Storage — evita subir un
        // archivo que después no se va a poder insertar. La protección
        // definitiva de todas formas vive en el trigger de la base (ver
        // supabase/migrations/20260810_gallery_items.sql); esto es solo para
        // no gastar un upload en vano cuando ya se sabe que va a fallar.
        if (alcanzoElLimite) {
            showMessage('error', `Ya hay ${GALLERY_MAX_ITEMS} imágenes cargadas. Eliminá una antes de agregar otra.`);
            return;
        }

        // 2. Archivo seleccionado y válido
        if (!imageFile) {
            setErrorImagen('Seleccioná una imagen para agregar.');
            return;
        }

        setSubmitting(true);
        setErrorImagen('');

        try {
            // 3. Redimensionar + convertir a WebP y subir a Storage — ver
            // src/utils/optimizeImage.js. Si la optimización falla no se
            // sube nada.
            const { file: optimizedFile } = await optimizeImage(imageFile);
            const path = `${Date.now()}-${sanitizeFileName(optimizedFile.name)}`;
            // TEMP DEBUG — sacar después de confirmar en consola qué llega a .upload().
            console.log('[GalleryList upload debug] original:', imageFile.name, imageFile.size, imageFile.type);
            console.log('[GalleryList upload debug] optimizado:', optimizedFile.name, optimizedFile.size, optimizedFile.type);
            console.log('[GalleryList upload debug] path final:', path);
            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(path, optimizedFile, { upsert: false, contentType: optimizedFile.type });
            if (uploadError) throw uploadError;

            // 4-5. Insertar la fila con el path (no la URL)
            const nextSortOrder = galleryItems && galleryItems.length > 0
                ? Math.max(...galleryItems.map(i => i.sort_order)) + 1
                : 0;

            const { data, error: insertError } = await supabase
                .from('gallery_items')
                .insert({
                    image_path: path,
                    title: newTitle.trim(),
                    subtitle: newSubtitle.trim(),
                    sort_order: nextSortOrder,
                })
                .select('id, image_path, title, subtitle, sort_order, created_at')
                .single();

            if (insertError) {
                // 6. El insert falló después de subir el archivo — no dejarlo
                // huérfano si se puede evitar (best-effort).
                const { error: cleanupError } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
                if (cleanupError) {
                    console.error('No se pudo limpiar el archivo tras un insert fallido:', path, cleanupError);
                }
                throw insertError;
            }

            setGalleryItems(prev => [...(prev || []), data].sort((a, b) => a.sort_order - b.sort_order));
            resetFormAlta();
            showMessage('success', 'Imagen agregada a la galería.');
        } catch (err) {
            console.error('Error al agregar imagen a la galería:', err);
            const mensaje = err instanceof ImageOptimizationError
                ? err.message
                : (mapGalleryRuleError(err) || 'Hubo un error al agregar la imagen. Intentá de nuevo.');
            showMessage('error', mensaje);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Edición de título/subtítulo ─────────────────────
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editSubtitle, setEditSubtitle] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    const startEdit = (item) => {
        setEditingId(item.id);
        setEditTitle(item.title);
        setEditSubtitle(item.subtitle);
    };

    const cancelEdit = () => setEditingId(null);

    const saveEdit = async (item) => {
        if (savingEdit) return;
        setSavingEdit(true);
        try {
            const nextTitle = editTitle.trim();
            const nextSubtitle = editSubtitle.trim();
            const { error } = await supabase
                .from('gallery_items')
                .update({ title: nextTitle, subtitle: nextSubtitle })
                .eq('id', item.id);
            if (error) throw error;

            setGalleryItems(prev =>
                prev.map(i => (i.id === item.id ? { ...i, title: nextTitle, subtitle: nextSubtitle } : i))
            );
            setEditingId(null);
            showMessage('success', 'Cambios guardados.');
        } catch (err) {
            console.error('Error al editar item de galería:', err);
            showMessage('error', 'Hubo un error al guardar los cambios. Intentá de nuevo.');
        } finally {
            setSavingEdit(false);
        }
    };

    // ── Orden (subir/bajar) ──────────────────────────────
    const [movingId, setMovingId] = useState(null);

    const moveItem = async (index, direction) => {
        if (!galleryItems || movingId) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= galleryItems.length) return;

        const current = galleryItems[index];
        const target = galleryItems[targetIndex];
        setMovingId(current.id);

        try {
            // Intercambia sort_order entre los dos vecinos. Si la segunda
            // actualización fallara justo después de la primera (caída de
            // red a mitad de camino), podrían quedar dos filas con el mismo
            // sort_order hasta la próxima recarga — caso borde documentado
            // en docs/galeria.md, no se agrega un mecanismo de rollback para
            // esto (tabla chica, uso exclusivo de un admin a la vez).
            const { error: err1 } = await supabase
                .from('gallery_items')
                .update({ sort_order: target.sort_order })
                .eq('id', current.id);
            if (err1) throw err1;

            const { error: err2 } = await supabase
                .from('gallery_items')
                .update({ sort_order: current.sort_order })
                .eq('id', target.id);
            if (err2) throw err2;

            const updated = [...galleryItems];
            updated[index] = { ...current, sort_order: target.sort_order };
            updated[targetIndex] = { ...target, sort_order: current.sort_order };
            updated.sort((a, b) => a.sort_order - b.sort_order);
            setGalleryItems(updated);
        } catch (err) {
            console.error('Error al reordenar la galería:', err);
            showMessage('error', 'Hubo un error al cambiar el orden. Intentá de nuevo.');
        } finally {
            setMovingId(null);
        }
    };

    // ── Eliminación ───────────────────────────────────────
    const [deletingId, setDeletingId] = useState(null);

    const handleDelete = async (item) => {
        if (deletingId) return;
        if (!window.confirm('¿Eliminar esta imagen de la galería? Esta acción no se puede deshacer.')) return;

        setDeletingId(item.id);
        try {
            // 1-2. Conservar el path en memoria y borrar primero la fila.
            const { error: deleteError } = await supabase
                .from('gallery_items')
                .delete()
                .eq('id', item.id);

            if (deleteError) {
                // 3. El DELETE falló: no tocar Storage.
                throw deleteError;
            }

            // 4. El DELETE funcionó — actualizar la UI y renumerar
            // sort_order de forma secuencial (0..n-1) para no dejar huecos
            // ni arrastrar valores duplicados en próximas altas/movimientos.
            const remaining = (galleryItems || []).filter(i => i.id !== item.id);
            const cambiosDeOrden = [];
            const renumerado = remaining.map((it, idx) => {
                if (it.sort_order !== idx) cambiosDeOrden.push({ id: it.id, sort_order: idx });
                return { ...it, sort_order: idx };
            });
            setGalleryItems(renumerado);

            if (cambiosDeOrden.length > 0) {
                await Promise.all(
                    cambiosDeOrden.map(c =>
                        supabase.from('gallery_items').update({ sort_order: c.sort_order }).eq('id', c.id)
                    )
                );
            }

            // 5. Intentar limpiar Storage (best-effort). Si falla, la fila
            // ya no existe — no se restaura — y se avisa al admin.
            const { error: storageError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .remove([item.image_path]);

            if (storageError) {
                console.error('No se pudo eliminar el archivo de Storage:', item.image_path, storageError);
                showMessage(
                    'error',
                    'La imagen se eliminó de la galería, pero puede haber quedado un archivo pendiente de limpieza en Storage. Revisar manualmente.',
                    8000
                );
            } else {
                showMessage('success', 'Imagen eliminada.');
            }
        } catch (err) {
            console.error('Error al eliminar item de galería:', err);
            showMessage('error', 'Hubo un error al eliminar la imagen. Intentá de nuevo.');
        } finally {
            setDeletingId(null);
        }
    };

    if (galleryLoading) return <div className="inscriptions-container">Cargando galería...</div>;
    if (galleryError) return <div className="error-message-admin">Error al cargar la galería: {galleryError}</div>;

    const cantidad = galleryItems?.length ?? 0;

    return (
        <div className="inscriptions-container">
            <h2 className="titulos-admin">Galería</h2>

            <p className={`gallery-counter${alcanzoElLimite ? ' gallery-counter--limit' : ''}`}>
                {cantidad} / {GALLERY_MAX_ITEMS} imágenes utilizadas
            </p>

            {message.text && (
                <div className={message.type === 'success' ? 'success-message-admin' : 'error-message-admin'}>
                    {message.text}
                </div>
            )}

            <form className="gallery-add-panel" onSubmit={handleAdd}>
                <div className="filter-group">
                    <label className="filter-label">Nueva imagen:</label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="email-masivo-file-input"
                        disabled={submitting || alcanzoElLimite}
                    />
                    {errorImagen && <p className="error-message-admin">{errorImagen}</p>}
                    {imagePreview && (
                        <div className="email-masivo-imagen-preview">
                            <img src={imagePreview} alt="Preview" />
                        </div>
                    )}
                </div>

                <div className="filter-group">
                    <label className="filter-label">Título:</label>
                    <input
                        type="text"
                        className="filter-select"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        disabled={submitting || alcanzoElLimite}
                        placeholder="Ej: Gran Final"
                    />
                </div>

                <div className="filter-group">
                    <label className="filter-label">Subtítulo:</label>
                    <input
                        type="text"
                        className="filter-select"
                        value={newSubtitle}
                        onChange={(e) => setNewSubtitle(e.target.value)}
                        disabled={submitting || alcanzoElLimite}
                        placeholder="Ej: Más de 300 participantes"
                    />
                </div>

                {alcanzoElLimite && (
                    <p className="error-message-admin">
                        Se alcanzó el máximo de {GALLERY_MAX_ITEMS} imágenes. Eliminá una imagen antes de agregar otra.
                    </p>
                )}

                <button className="export-button" type="submit" disabled={submitting || alcanzoElLimite}>
                    {submitting ? 'Agregando…' : 'Agregar imagen'}
                </button>
            </form>

            <div className="table-wrapper">
                <table className="inscriptions-table">
                    <thead>
                        <tr>
                            <th>Imagen</th>
                            <th>Título</th>
                            <th>Subtítulo</th>
                            <th>Posición</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {galleryItems?.map((item, index) => (
                            <tr key={item.id}>
                                <td>
                                    <img
                                        src={getPublicUrl(item.image_path)}
                                        alt={item.title || 'Imagen de galería'}
                                        className="gallery-thumb"
                                        loading="lazy"
                                    />
                                </td>
                                {editingId === item.id ? (
                                    <>
                                        <td>
                                            <input
                                                type="text"
                                                className="filter-select"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="filter-select"
                                                value={editSubtitle}
                                                onChange={(e) => setEditSubtitle(e.target.value)}
                                            />
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td>{item.title || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                                        <td>{item.subtitle || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                                    </>
                                )}
                                <td>
                                    <div className="gallery-order-btns">
                                        <button
                                            type="button"
                                            className="gallery-order-btn"
                                            onClick={() => moveItem(index, 'up')}
                                            disabled={index === 0 || movingId === item.id}
                                            title="Subir"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            className="gallery-order-btn"
                                            onClick={() => moveItem(index, 'down')}
                                            disabled={index === galleryItems.length - 1 || movingId === item.id}
                                            title="Bajar"
                                        >
                                            ↓
                                        </button>
                                    </div>
                                </td>
                                <td>
                                    <div className="gallery-row-actions">
                                        {editingId === item.id ? (
                                            <>
                                                <button
                                                    type="button"
                                                    className="export-button"
                                                    style={{ margin: 0 }}
                                                    onClick={() => saveEdit(item)}
                                                    disabled={savingEdit}
                                                >
                                                    {savingEdit ? 'Guardando…' : 'Guardar'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="cancel-button"
                                                    style={{ margin: 0 }}
                                                    onClick={cancelEdit}
                                                    disabled={savingEdit}
                                                >
                                                    Cancelar
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className="export-button"
                                                    style={{ margin: 0 }}
                                                    onClick={() => startEdit(item)}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="cancel-button"
                                                    style={{ margin: 0 }}
                                                    onClick={() => handleDelete(item)}
                                                    disabled={deletingId === item.id}
                                                >
                                                    {deletingId === item.id ? 'Eliminando…' : 'Eliminar'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {cantidad === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af' }}>
                                    Todavía no hay imágenes en la galería.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

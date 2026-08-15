import { useRef, useState } from 'react';
import supabase from '../../../../utils/supabase';
import { useGamesAdmin } from '../../../../hooks/useGamesAdmin';
import { mapGamesRuleError } from '../../../../utils/gamesRules';
import { optimizeImage, ImageOptimizationError } from '../../../../utils/optimizeImage';

const STORAGE_BUCKET = 'juegos';

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Máximo específico para imágenes de juego — más chico que el default de
// optimizeImage.js (1600px, pensado para banners de eventos). La card de
// SeleccionJuego.jsx nunca la muestra a más de 220px de ancho CSS en NINGÚN
// breakpoint (.sj-cards-grid usa `minmax(0, 220px)` desde 768px en adelante,
// y en mobile el grid de 2 columnas dentro de .sj-page —max-width:480px—
// nunca supera esos ~220px tampoco; no hay ningún lightbox ni vista que la
// agrande más). 220px × 2 (para pantallas de alta densidad/Retina, criterio
// pedido) = 440px de necesidad real; se redondea a 600px para dejar margen
// y cubrir parte de pantallas 3x sin sumar peso de más. Ver docs/games.md.
const GAME_IMAGE_MAX_DIMENSION = 600;

const getPublicUrl = (path) =>
    supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;

// Mismo criterio de saneo que ya usan AddTournamentForm.jsx, EmailMasivo.jsx
// y GalleryList.jsx para sus propios uploads.
const sanitizeFileName = (name) =>
    name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');

const validateImageFile = (file) => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        return 'Formato no permitido. Subí una imagen JPG, PNG o WebP.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return 'El archivo supera el tamaño máximo permitido (5 MB).';
    }
    return null;
};

export const GamesList = () => {
    const { games, gamesError, gamesLoading, setGames } = useGamesAdmin();

    const [message, setMessage] = useState({ type: '', text: '' });
    const showMessage = (type, text, timeout = 4000) => {
        setMessage({ type, text });
        if (timeout) setTimeout(() => setMessage({ type: '', text: '' }), timeout);
    };

    // ── Alta ─────────────────────────────────────────────
    const fileInputRef = useRef(null);
    const [newGameName, setNewGameName] = useState('');
    // Defaults conservadores (ver docs/games.md, "Alta de un juego nuevo"):
    // un juego nuevo entra como individual/secundario salvo que se elija lo
    // contrario a propósito.
    const [newTeamOption, setNewTeamOption] = useState('individual'); // 'individual' | 'equipo'
    const [newPrincipal, setNewPrincipal] = useState('secundario'); // 'secundario' | 'principal'
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [errorImagen, setErrorImagen] = useState('');
    const [errorForm, setErrorForm] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const resetFormAlta = () => {
        setNewGameName('');
        setNewTeamOption('individual');
        setNewPrincipal('secundario');
        setImageFile(null);
        setImagePreview('');
        setErrorImagen('');
        setErrorForm('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) {
            setImageFile(null);
            setImagePreview('');
            return;
        }
        setErrorImagen('');

        const validationError = validateImageFile(file);
        if (validationError) {
            setErrorImagen(validationError);
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

        const trimmedName = newGameName.trim();
        if (!trimmedName) {
            setErrorForm('Ingresá el nombre del juego.');
            return;
        }

        // Chequeo de duplicado contra el listado ya cargado (case-insensitive,
        // sin espacios al borde) — feedback inmediato sin gastar un upload en
        // vano. La protección definitiva es el índice UNIQUE de la migración
        // (ver mapGamesRuleError más abajo).
        const yaExiste = (games || []).some(
            g => g.game_name.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (yaExiste) {
            setErrorForm('Ya existe un juego con ese nombre.');
            return;
        }

        if (imageFile) {
            const validationError = validateImageFile(imageFile);
            if (validationError) {
                setErrorImagen(validationError);
                return;
            }
        }

        setSubmitting(true);
        setErrorForm('');
        setErrorImagen('');

        // La imagen es opcional al crear (ver docs/games.md) — si no se
        // seleccionó archivo, image_path queda null y el juego sigue
        // dependiendo de gameConfig.js/los assets hardcodeados, exactamente
        // igual que los juegos existentes.
        let uploadedPath = null;

        try {
            if (imageFile) {
                // Redimensiona + convierte a WebP antes de subir — ver
                // src/utils/optimizeImage.js. Si falla, no se sube nada (ni
                // el original ni un archivo parcial).
                const { file: optimizedFile } = await optimizeImage(imageFile, { maxDimension: GAME_IMAGE_MAX_DIMENSION });
                uploadedPath = `${Date.now()}-${sanitizeFileName(optimizedFile.name)}`;
                const { error: uploadError } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .upload(uploadedPath, optimizedFile, { upsert: false, contentType: optimizedFile.type });
                if (uploadError) throw uploadError;
            }

            const { data, error: insertError } = await supabase
                .from('games')
                .insert({
                    game_name: trimmedName,
                    team_option: newTeamOption === 'equipo',
                    principal: newPrincipal === 'principal',
                    active: true,
                    image_path: uploadedPath,
                })
                .select('id, game_name, team_option, principal, active, image_path')
                .single();

            if (insertError) {
                // El insert falló después de subir el archivo — no dejarlo
                // huérfano si se puede evitar (best-effort).
                if (uploadedPath) {
                    const { error: cleanupError } = await supabase.storage.from(STORAGE_BUCKET).remove([uploadedPath]);
                    if (cleanupError) {
                        console.error('No se pudo limpiar el archivo tras un insert fallido:', uploadedPath, cleanupError);
                    }
                }
                throw insertError;
            }

            setGames(prev => [...(prev || []), data].sort((a, b) => a.game_name.localeCompare(b.game_name, 'es')));
            resetFormAlta();
            showMessage('success', 'Juego creado correctamente.');
        } catch (err) {
            console.error('Error al crear juego:', err);
            const mensaje = err instanceof ImageOptimizationError
                ? err.message
                : (mapGamesRuleError(err) || 'Hubo un error al crear el juego. Intentá de nuevo.');
            showMessage('error', mensaje);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Reemplazo de imagen ──────────────────────────────
    const replaceFileInputRef = useRef(null);
    const [replacingGame, setReplacingGame] = useState(null);
    const [replacingId, setReplacingId] = useState(null);

    const triggerReplace = (game) => {
        if (replacingId) return;
        setReplacingGame(game);
        replaceFileInputRef.current?.click();
    };

    const handleReplaceImage = async (game, file) => {
        if (replacingId) return;
        setReplacingId(game.id);

        try {
            // 1-3. Subir la imagen nueva con un path nuevo — nunca se pisa el
            // path viejo (upsert: false), así que la imagen anterior sigue
            // intacta y sirviéndose mientras dure este upload. Se optimiza
            // (resize + WebP) antes de subir, igual que en el alta.
            const { file: optimizedFile } = await optimizeImage(file, { maxDimension: GAME_IMAGE_MAX_DIMENSION });
            const newPath = `${Date.now()}-${sanitizeFileName(optimizedFile.name)}`;
            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(newPath, optimizedFile, { upsert: false, contentType: optimizedFile.type });
            if (uploadError) throw uploadError;

            // 4. UPDATE solamente de image_path.
            const { error: updateError } = await supabase
                .from('games')
                .update({ image_path: newPath })
                .eq('id', game.id);

            if (updateError) {
                // 5. El UPDATE falló: limpiar la imagen nueva (best-effort) y
                // conservar la anterior — el juego no cambia de estado.
                const { error: cleanupError } = await supabase.storage.from(STORAGE_BUCKET).remove([newPath]);
                if (cleanupError) {
                    console.error('No se pudo limpiar la imagen nueva tras un update fallido:', newPath, cleanupError);
                }
                throw updateError;
            }

            // 6. El UPDATE funcionó — lo que le importa al usuario ya está
            // resuelto (el juego ya muestra la imagen nueva). Reflejarlo en
            // la UI antes de intentar limpiar la imagen vieja.
            setGames(prev => prev.map(g => (g.id === game.id ? { ...g, image_path: newPath } : g)));

            const oldPath = game.image_path;
            if (oldPath) {
                const { error: deleteOldError } = await supabase.storage.from(STORAGE_BUCKET).remove([oldPath]);
                if (deleteOldError) {
                    // 7. No se revierte el update ya aplicado — se informa el
                    // posible archivo huérfano.
                    console.error('No se pudo eliminar la imagen anterior de Storage:', oldPath, deleteOldError);
                    showMessage(
                        'error',
                        'La imagen se reemplazó correctamente, pero puede haber quedado un archivo anterior pendiente de limpieza en Storage. Revisar manualmente.',
                        8000
                    );
                    return;
                }
            }

            showMessage('success', 'Imagen actualizada correctamente.');
        } catch (err) {
            console.error('Error al reemplazar la imagen del juego:', err);
            showMessage('error', err instanceof ImageOptimizationError
                ? err.message
                : 'Hubo un error al actualizar la imagen. Intentá de nuevo.');
        } finally {
            setReplacingId(null);
            setReplacingGame(null);
        }
    };

    const handleReplaceFileChange = (e) => {
        const file = e.target.files[0];
        const game = replacingGame;
        e.target.value = '';
        if (!file || !game) return;

        const validationError = validateImageFile(file);
        if (validationError) {
            showMessage('error', validationError);
            setReplacingGame(null);
            return;
        }

        handleReplaceImage(game, file);
    };

    if (gamesLoading) return <div className="inscriptions-container">Cargando juegos...</div>;
    if (gamesError) return <div className="error-message-admin">Error al cargar los juegos: {gamesError}</div>;

    const cantidad = games?.length ?? 0;

    return (
        <div className="inscriptions-container">
            <h2 className="titulos-admin">Juegos</h2>

            {message.text && (
                <div className={message.type === 'success' ? 'success-message-admin' : 'error-message-admin'}>
                    {message.text}
                </div>
            )}

            <form className="gallery-add-panel" onSubmit={handleAdd}>
                <div className="filter-group">
                    <label className="filter-label">Nombre del juego:</label>
                    <input
                        type="text"
                        className="filter-select"
                        value={newGameName}
                        onChange={(e) => setNewGameName(e.target.value)}
                        disabled={submitting}
                        placeholder="Ej: Fortnite"
                    />
                    {errorForm && <p className="error-message-admin">{errorForm}</p>}
                </div>

                <div className="filter-group">
                    <label className="filter-label">Tipo:</label>
                    <select
                        className="filter-select"
                        value={newTeamOption}
                        onChange={(e) => setNewTeamOption(e.target.value)}
                        disabled={submitting}
                    >
                        <option value="individual">Individual</option>
                        <option value="equipo">Equipo</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label className="filter-label">Categoría:</label>
                    <select
                        className="filter-select"
                        value={newPrincipal}
                        onChange={(e) => setNewPrincipal(e.target.value)}
                        disabled={submitting}
                    >
                        <option value="secundario">Secundario</option>
                        <option value="principal">Principal</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label className="filter-label">Imagen (opcional):</label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="email-masivo-file-input"
                        disabled={submitting}
                    />
                    {errorImagen && <p className="error-message-admin">{errorImagen}</p>}
                    {imagePreview && (
                        <div className="email-masivo-imagen-preview">
                            <img src={imagePreview} alt="Preview" />
                        </div>
                    )}
                </div>

                <button className="export-button" type="submit" disabled={submitting}>
                    {submitting ? 'Creando…' : 'Crear juego'}
                </button>
            </form>

            {/* Input oculto compartido para "Cargar imagen"/"Reemplazar imagen" de cada fila */}
            <input
                ref={replaceFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleReplaceFileChange}
                style={{ display: 'none' }}
            />

            <div className="table-wrapper">
                <table className="inscriptions-table">
                    <thead>
                        <tr>
                            <th>Imagen</th>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th>Categoría</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {games?.map(game => (
                            <tr key={game.id}>
                                <td>
                                    {game.image_path ? (
                                        <img
                                            src={getPublicUrl(game.image_path)}
                                            alt={game.game_name}
                                            className="games-thumb"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="games-thumb games-thumb--empty">Sin imagen</div>
                                    )}
                                </td>
                                <td>{game.game_name}</td>
                                <td>
                                    <span className="games-badge games-badge--neutral">
                                        {game.team_option ? 'Equipo' : 'Individual'}
                                    </span>
                                </td>
                                <td>
                                    <span className="games-badge games-badge--neutral">
                                        {game.principal ? 'Principal' : 'Secundario'}
                                    </span>
                                </td>
                                <td>
                                    <span className={`games-badge${game.active ? ' games-badge--active' : ' games-badge--inactive'}`}>
                                        {game.active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        className="export-button"
                                        style={{ margin: 0 }}
                                        onClick={() => triggerReplace(game)}
                                        disabled={replacingId === game.id}
                                    >
                                        {replacingId === game.id
                                            ? 'Subiendo…'
                                            : (game.image_path ? 'Reemplazar imagen' : 'Cargar imagen')}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {cantidad === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af' }}>
                                    Todavía no hay juegos cargados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

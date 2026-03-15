import { useState, useEffect, useRef } from 'react'
import supabase from '../../../../utils/supabase'
import { localidadesBuenosAires } from '../../../../data/localidades'
import { useGames } from '../../../../hooks/useGames'

const generateSlug = (localidad, fecha) => {
    if (!localidad || !fecha) return '';
    const loc = localidad
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    return `${loc}-${fecha}`;
};

export const AddTournamentForm = ({ onSuccess }) => {
    const [formValues, setFormValues] = useState({
        fecha_inicio: "",
        fecha_fin: "",
        localidad: "",
        hora_inicio: "",
        direccion: "",
    });

    const localidadesOptions = localidadesBuenosAires.map((localidad) => ({
        value: localidad,
        label: localidad,
    }));

    const { games, loading: loadingGames, error: errorGames } = useGames();
    const [selectedGames, setSelectedGames] = useState([]);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // Imagen
    const [imageFile, setImageFile] = useState(null);
    const [imagenPreview, setImagenPreview] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [errorImagen, setErrorImagen] = useState('');
    const fileInputRef = useRef(null);

    // Marcar todos los juegos por defecto al cargar
    useEffect(() => {
        if (games && games.length > 0) {
            setSelectedGames(games.map(g => g.id));
        }
    }, [games]);

    const handleCheckboxChange = (gameId) => {
        setSelectedGames((prev) =>
            prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
        );
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormValues((prev) => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImageFile(file);
        setErrorImagen('');
        const reader = new FileReader();
        reader.onload = (ev) => setImagenPreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        const { fecha_inicio, fecha_fin, localidad, hora_inicio, direccion } = formValues;

        if (!fecha_inicio || !fecha_fin || !localidad) {
            setErrorMessage("Por favor completá todos los campos obligatorios (*).");
            return;
        }

        if (selectedGames.length === 0) {
            setErrorMessage("Por favor, seleccioná al menos un juego.");
            return;
        }

        try {
            // Subir imagen si se seleccionó una
            let imagen_url = null;
            if (imageFile) {
                setUploadingImage(true);
                const safeName = imageFile.name
                    .replace(/\s+/g, '_')
                    .replace(/[^a-zA-Z0-9._-]/g, '');
                const path = `${Date.now()}-${safeName}`;
                const { error: uploadError } = await supabase.storage
                    .from('eventos')
                    .upload(path, imageFile, {
                        upsert: true,
                        contentType: imageFile.type,
                    });
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage.from('eventos').getPublicUrl(path);
                imagen_url = urlData.publicUrl;
                setUploadingImage(false);
            }

            const slug = generateSlug(localidad, fecha_inicio);

            // ── DIAGNÓSTICO: comparar objeto insert con/sin imagen ──
            const insertPayload = {
                fecha_inicio,
                fecha_fin,
                localidad,
                hora_inicio: hora_inicio || null,
                direccion: direccion || null,
                slug,
                imagen_url,
            };
            const { data: { session } } = await supabase.auth.getSession();
            console.log('[AddTournamentForm] insertPayload:', insertPayload);
            console.log('[AddTournamentForm] session activa:', session ? `uid=${session.user.id}` : 'null — SIN SESIÓN');
            // ────────────────────────────────────────────────────────

            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .insert(insertPayload)
                .select()
                .single();

            if (eventError) throw eventError;
            if (!eventData) throw new Error("No se recibieron datos.");

            const { error: gameInsertError } = await supabase
                .from("event_games")
                .insert(selectedGames.map(gameId => ({
                    game_id: gameId,
                    event_id: eventData.id,
                })));

            if (gameInsertError) throw gameInsertError;

            setSuccessMessage("Torneo creado con éxito.");
            setTimeout(() => onSuccess?.(), 1500);
        } catch (err) {
            setUploadingImage(false);
            const msg = err?.message || err?.error_description || JSON.stringify(err);
            console.error("Error al guardar torneo:", msg, err);
            setErrorMessage(`Error: ${msg}`);
        }
    };

    return (
        <div className="filters-container">
            <h3>Nuevo Torneo</h3>
            <form onSubmit={handleSubmit}>

                <div className="filter-group">
                    <label className="filter-label">Fecha de inicio: *</label>
                    <input
                        type="date"
                        name="fecha_inicio"
                        value={formValues.fecha_inicio}
                        onChange={handleInputChange}
                        className="filter-date"
                    />
                </div>

                <div className="filter-group">
                    <label className="filter-label">Fecha de finalización: *</label>
                    <input
                        type="date"
                        name="fecha_fin"
                        value={formValues.fecha_fin}
                        onChange={handleInputChange}
                        className="filter-date"
                    />
                </div>

                <div className="filter-group">
                    <label className="filter-label">Hora de inicio:</label>
                    <input
                        type="time"
                        name="hora_inicio"
                        value={formValues.hora_inicio}
                        onChange={handleInputChange}
                        className="filter-date"
                    />
                </div>

                <div className="filter-group">
                    <label className="filter-label">Localidad: *</label>
                    <select
                        name="localidad"
                        value={formValues.localidad}
                        onChange={handleInputChange}
                        className="filter-select"
                    >
                        <option value="">Seleccioná una localidad</option>
                        {localidadesOptions.map((localidad, index) => (
                            <option key={index} value={localidad.value}>
                                {localidad.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label className="filter-label">Dirección:</label>
                    <input
                        type="text"
                        name="direccion"
                        value={formValues.direccion}
                        onChange={handleInputChange}
                        className="filter-select"
                        placeholder="Ej: Av. Corrientes 1234"
                    />
                </div>

                <div className="filter-group">
                    <label className="filter-label">Imagen del evento (opcional):</label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="email-masivo-file-input"
                        disabled={uploadingImage}
                    />
                    {uploadingImage && (
                        <p style={{ color: '#3b6cb4', fontSize: '0.85rem', margin: '4px 0 0' }}>
                            Subiendo imagen...
                        </p>
                    )}
                    {errorImagen && <p className="error-message-admin">{errorImagen}</p>}
                    {imagenPreview && !uploadingImage && (
                        <div className="email-masivo-imagen-preview">
                            <img src={imagenPreview} alt="Preview" />
                        </div>
                    )}
                </div>

                <div className="filter-group">
                    <label className="filter-label">Juegos: *</label>
                    {loadingGames && <p>Cargando juegos...</p>}
                    {errorGames && <p className="error-message-admin">Error al cargar juegos: {errorGames}</p>}
                    <div className="checkbox-grid">
                        {!loadingGames && !errorGames && games.length > 0 ? (
                            games.map((game) => (
                                <label key={game.id} className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        value={game.id}
                                        checked={selectedGames.includes(game.id)}
                                        onChange={() => handleCheckboxChange(game.id)}
                                    />
                                    {game.game_name}
                                </label>
                            ))
                        ) : (
                            !loadingGames && !errorGames && <p>No hay juegos disponibles.</p>
                        )}
                    </div>
                </div>

                {errorMessage && <p className="error-message-admin">{errorMessage}</p>}
                {successMessage && <p className="success-message-admin">{successMessage}</p>}

                <button
                    type="submit"
                    className="export-button"
                    disabled={uploadingImage}
                    style={{ opacity: uploadingImage ? 0.6 : 1 }}
                >
                    {uploadingImage ? 'Subiendo imagen...' : 'Guardar torneo'}
                </button>
            </form>
        </div>
    );
};

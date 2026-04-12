import { useState, useEffect, useRef } from 'react'
import supabase from '../../../../utils/supabase'
import { localidadesBuenosAires } from '../../../../data/localidades'
import { useGames } from '../../../../hooks/useGames'

const DIAS_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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

// Genera array de fechas ISO entre dos fechas (inclusive)
const getDatesInRange = (startStr, endStr) => {
    const dates = [];
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    const cur = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    while (cur <= end) {
        dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
};

const formatDiaLabel = (fechaStr) => {
    const [y, m, d] = fechaStr.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return `${DIAS_NOMBRES[fecha.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

export const AddTournamentForm = ({ onSuccess }) => {
    const [formValues, setFormValues] = useState({
        fecha_inicio: "",
        fecha_fin: "",
        localidad: "",
        hora_inicio: "",
        direccion: "",
        ubicacion_url: "",
    });

    const localidadesOptions = localidadesBuenosAires.map((localidad) => ({
        value: localidad,
        label: localidad,
    }));

    const { games, loading: loadingGames, error: errorGames } = useGames();
    const [selectedGames, setSelectedGames] = useState([]);
    // gameDays: { [gameId]: string[] } — días seleccionados por juego.
    // Si no hay entrada para un juego, se asume que juega todos los días del evento.
    const [gameDays, setGameDays] = useState({});
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

    const isMultiDay = Boolean(
        formValues.fecha_inicio &&
        formValues.fecha_fin &&
        formValues.fecha_inicio !== formValues.fecha_fin
    );
    const eventDates = isMultiDay
        ? getDatesInRange(formValues.fecha_inicio, formValues.fecha_fin)
        : [];

    // Días efectivos de un juego: los seleccionados, o todos los del evento si no se especificó
    const getEffectiveDays = (gameId) => gameDays[gameId] ?? eventDates;

    const handleCheckboxChange = (gameId) => {
        setSelectedGames((prev) =>
            prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
        );
    };

    const handleDayToggle = (gameId, date) => {
        const current = getEffectiveDays(gameId);
        const next = current.includes(date)
            ? current.filter(d => d !== date)
            : [...current, date].sort();
        setGameDays(prev => ({ ...prev, [gameId]: next }));
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

        const { fecha_inicio, fecha_fin, localidad, hora_inicio, direccion, ubicacion_url } = formValues;

        if (!fecha_inicio || !fecha_fin || !localidad) {
            setErrorMessage("Por favor completá todos los campos obligatorios (*).");
            return;
        }

        if (selectedGames.length === 0) {
            setErrorMessage("Por favor, seleccioná al menos un juego.");
            return;
        }

        // Validar que cada juego tenga al menos un día seleccionado en eventos multi-día
        if (isMultiDay) {
            for (const gameId of selectedGames) {
                if (getEffectiveDays(gameId).length === 0) {
                    const game = games.find(g => g.id === gameId);
                    setErrorMessage(`El juego "${game?.game_name}" no tiene ningún día seleccionado.`);
                    return;
                }
            }
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

            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .insert({
                    fecha_inicio,
                    fecha_fin,
                    localidad,
                    hora_inicio: hora_inicio || null,
                    direccion: direccion || null,
                    ubicacion_url: ubicacion_url || null,
                    slug,
                    imagen_url,
                })
                .select()
                .single();

            if (eventError) throw eventError;
            if (!eventData) throw new Error("No se recibieron datos.");

            // Insertar event_games y obtener sus IDs para poder agregar los días
            const { data: eventGamesData, error: gameInsertError } = await supabase
                .from("event_games")
                .insert(selectedGames.map(gameId => ({
                    game_id: gameId,
                    event_id: eventData.id,
                })))
                .select();

            if (gameInsertError) throw gameInsertError;

            // Insertar días específicos en event_games_days
            // Solo para juegos que NO juegan todos los días del evento
            if (isMultiDay && eventGamesData?.length > 0) {
                const daysToInsert = [];
                for (const eg of eventGamesData) {
                    const selectedDays = getEffectiveDays(eg.game_id);
                    // Si el juego no juega todos los días, guardar los días específicos
                    const playsAllDays = eventDates.every(d => selectedDays.includes(d));
                    if (!playsAllDays) {
                        selectedDays.forEach(date => {
                            daysToInsert.push({ event_game_id: eg.id, date });
                        });
                    }
                }
                if (daysToInsert.length > 0) {
                    const { error: daysError } = await supabase
                        .from('event_games_days')
                        .insert(daysToInsert);
                    if (daysError) throw daysError;
                }
            }

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
                    <label className="filter-label">Ubicación (Google Maps URL):</label>
                    <input
                        type="text"
                        name="ubicacion_url"
                        value={formValues.ubicacion_url}
                        onChange={handleInputChange}
                        className="filter-select"
                        placeholder="https://maps.google.com/..."
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
                            games.map((game) => {
                                const isSelected = selectedGames.includes(game.id);
                                const effectiveDays = getEffectiveDays(game.id);
                                return (
                                    <div key={game.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                value={game.id}
                                                checked={isSelected}
                                                onChange={() => handleCheckboxChange(game.id)}
                                            />
                                            {game.game_name}
                                        </label>

                                        {/* Días específicos — solo en eventos multi-día y juego seleccionado */}
                                        {isSelected && isMultiDay && (
                                            <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                <span style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.1rem' }}>
                                                    ¿Qué días se juega?
                                                </span>
                                                {eventDates.map(date => (
                                                    <label key={date} className="checkbox-label" style={{ fontSize: '0.83rem' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={effectiveDays.includes(date)}
                                                            onChange={() => handleDayToggle(game.id, date)}
                                                        />
                                                        {formatDiaLabel(date)}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
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

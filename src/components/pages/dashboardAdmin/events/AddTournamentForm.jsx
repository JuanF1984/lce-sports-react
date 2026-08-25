import { useState, useEffect, useRef } from 'react'
import supabase from '../../../../utils/supabase'
import { localidadesBuenosAires } from '../../../../data/localidades'
import { useGames } from '../../../../hooks/useGames'
import { validateImageFile } from '../../../../utils/imageUpload'
import { optimizeImage } from '../../../../utils/optimizeImage'
import { getDatesInRange } from '../../../../utils/eventDays'
import { GameDaysSelector } from './GameDaysSelector'

const BASE_URL = 'https://lcesports.com.ar';

// Slug base: lugar + fecha + tipo (p. ej. "chascomus-2026-08-22-torneo").
// No incluye correlativo: eso lo resuelve generateUniqueSlug contra los slugs existentes.
const buildSlugBase = (localidad, fecha, tipo) => {
    if (!localidad || !fecha || !tipo) return '';
    const loc = localidad
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    return `${loc}-${fecha}-${tipo}`;
};

// Busca el próximo slug libre para esta base consultando `events`. Si la base ya
// existe, agrega un correlativo -2, -3, etc. No es 100% atómico (dos altas en
// paralelo podrían pisarse la misma consulta): el UNIQUE en la base es la
// protección definitiva, ver docs/supabase.md.
const generateUniqueSlug = async (localidad, fecha, tipo) => {
    const base = buildSlugBase(localidad, fecha, tipo);
    if (!base) return '';

    const { data, error } = await supabase
        .from('events')
        .select('slug')
        .like('slug', `${base}%`);

    if (error) throw error;

    const existentes = new Set((data || []).map(e => e.slug));
    if (!existentes.has(base)) return base;

    let n = 2;
    while (existentes.has(`${base}-${n}`)) {
        n += 1;
    }
    return `${base}-${n}`;
};

export const AddTournamentForm = ({ onSuccess }) => {
    const [formValues, setFormValues] = useState({
        nombre: "",
        fecha_inicio: "",
        fecha_fin: "",
        localidad: "",
        hora_inicio: "",
        direccion: "",
        ubicacion_url: "",
        tipo: "torneo",
        visible_en_home: true,
        fecha_cierre_inscripcion: "",
        edad_minima: "",
        edad_maxima: "",
        modo_seleccion_juegos: "clasificado",
        max_juegos_por_participante: "",
    });

    const localidadesOptions = localidadesBuenosAires.map((localidad) => ({
        value: localidad,
        label: localidad,
    }));

    const { games, loading: loadingGames, error: errorGames } = useGames();
    const [selectedGames, setSelectedGames] = useState([]);
    const [gameDays, setGameDays] = useState({});
    // Modalidad de inscripción por juego (event_games.registration_mode).
    // Default al cargar el catálogo: si el juego admite equipo (team_option),
    // arranca en 'both' (igual que el comportamiento histórico de team_option=true);
    // si no, queda forzado en 'individual' y no se ofrece el selector.
    const [gameModes, setGameModes] = useState({});
    // Cupo máximo por juego (event_games.cupo_maximo). Independiente de
    // team_option/registration_mode — se ofrece para cualquier juego
    // seleccionado, sea individual, equipo o ambos. Valor de texto tal cual
    // lo tipea el admin ('' = sin límite); se convierte a entero recién al
    // armar el payload de inserción. Ver docs/games.md.
    const [gameCupos, setGameCupos] = useState({});
    const [successMessage, setSuccessMessage] = useState("");
    const [savedLink, setSavedLink] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [copied, setCopied] = useState(false);

    const [imageFile, setImageFile] = useState(null);
    const [imagenPreview, setImagenPreview] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [errorImagen, setErrorImagen] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (games && games.length > 0) {
            setSelectedGames(games.map(g => g.id));
            setGameModes(prev => {
                const next = { ...prev };
                games.forEach(g => {
                    if (next[g.id] === undefined) {
                        next[g.id] = g.team_option ? 'both' : 'individual';
                    }
                });
                return next;
            });
        }
    }, [games]);

    const handleModeChange = (gameId, mode) => {
        setGameModes(prev => ({ ...prev, [gameId]: mode }));
    };

    const handleCupoChange = (gameId, value) => {
        setGameCupos(prev => ({ ...prev, [gameId]: value }));
    };

    const esPresentacion = formValues.tipo === 'presentacion';

    const isMultiDay = Boolean(
        formValues.fecha_inicio &&
        formValues.fecha_fin &&
        formValues.fecha_inicio !== formValues.fecha_fin
    );
    const eventDates = isMultiDay
        ? getDatesInRange(formValues.fecha_inicio, formValues.fecha_fin)
        : [];

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
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        setFormValues((prev) => {
            const updated = { ...prev, [name]: newValue };
            if (name === 'tipo' && newValue === 'presentacion') {
                updated.visible_en_home = false;
            }
            return updated;
        });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setErrorImagen('');

        const validationError = validateImageFile(file);
        if (validationError) {
            setErrorImagen(validationError);
            setImageFile(null);
            setImagenPreview('');
            e.target.value = '';
            return;
        }

        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagenPreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(savedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Evita altas duplicadas por doble click / doble submit mientras la
        // primera request todavía está en vuelo (causa concreta de eventos
        // duplicados con el mismo lugar+fecha detectada en producción).
        if (submitting) return;
        setSubmitting(true);
        setErrorMessage("");
        setSuccessMessage("");
        setSavedLink("");

        const { nombre, fecha_inicio, fecha_fin, localidad, hora_inicio, direccion, ubicacion_url, tipo, visible_en_home, fecha_cierre_inscripcion, edad_minima, edad_maxima, modo_seleccion_juegos, max_juegos_por_participante } = formValues;

        if (!fecha_inicio || !fecha_fin || !localidad) {
            setErrorMessage("Por favor completá todos los campos obligatorios (*).");
            setSubmitting(false);
            return;
        }

        if (!esPresentacion && selectedGames.length === 0) {
            setErrorMessage("Por favor, seleccioná al menos un juego.");
            setSubmitting(false);
            return;
        }

        // Reglas de edad/cantidad de juegos: validación de UI antes de mandar
        // nada a Supabase. La validación definitiva vive igual en la base
        // (ver supabase/migrations/20260804_event_participation_rules.sql).
        const edadMinimaNum = edad_minima !== "" ? Number(edad_minima) : null;
        const edadMaximaNum = edad_maxima !== "" ? Number(edad_maxima) : null;
        const maxJuegosNum = max_juegos_por_participante !== "" ? Number(max_juegos_por_participante) : null;

        if (edadMinimaNum !== null && edadMinimaNum < 0) {
            setErrorMessage("La edad mínima no puede ser negativa.");
            setSubmitting(false);
            return;
        }
        if (edadMaximaNum !== null && edadMaximaNum < 0) {
            setErrorMessage("La edad máxima no puede ser negativa.");
            setSubmitting(false);
            return;
        }
        if (edadMinimaNum !== null && edadMaximaNum !== null && edadMinimaNum > edadMaximaNum) {
            setErrorMessage("La edad mínima no puede ser mayor que la edad máxima.");
            setSubmitting(false);
            return;
        }
        if (modo_seleccion_juegos === 'libre' && maxJuegosNum !== null && maxJuegosNum < 1) {
            setErrorMessage("El máximo de juegos por participante debe ser al menos 1 (o dejarse vacío para no limitarlo).");
            setSubmitting(false);
            return;
        }

        // Cupo máximo por juego (event_games.cupo_maximo): validación de UI,
        // la definitiva es el constraint `cupo_maximo >= 0` de la base (ver
        // supabase/migrations/20260824_event_game_cupos.sql). Vacío = sin
        // límite, 0 = juego cerrado desde el alta, cualquier otro entero
        // negativo se rechaza acá.
        if (!esPresentacion) {
            for (const gameId of selectedGames) {
                const raw = gameCupos[gameId];
                if (raw === '' || raw == null) continue;
                const n = Number(raw);
                if (!Number.isInteger(n) || n < 0) {
                    const game = games.find(g => g.id === gameId);
                    setErrorMessage(`El cupo de "${game?.game_name || 'un juego'}" debe ser un número entero mayor o igual a 0 (o vacío para sin límite).`);
                    setSubmitting(false);
                    return;
                }
            }
        }

        if (!esPresentacion && isMultiDay) {
            for (const gameId of selectedGames) {
                if (getEffectiveDays(gameId).length === 0) {
                    const game = games.find(g => g.id === gameId);
                    setErrorMessage(`El juego "${game?.game_name}" no tiene ningún día seleccionado.`);
                    setSubmitting(false);
                    return;
                }
            }
        }

        if (imageFile) {
            const validationError = validateImageFile(imageFile);
            if (validationError) {
                setErrorImagen(validationError);
                setSubmitting(false);
                return;
            }
        }

        try {
            let imagen_url = null;
            if (imageFile) {
                setUploadingImage(true);
                // Redimensiona + convierte a WebP antes de subir — ver
                // src/utils/optimizeImage.js. Si falla, lanza
                // ImageOptimizationError y cae al catch general de abajo
                // (que ya muestra err.message tal cual).
                const { file: optimizedFile } = await optimizeImage(imageFile);
                const safeName = optimizedFile.name
                    .replace(/\s+/g, '_')
                    .replace(/[^a-zA-Z0-9._-]/g, '');
                const path = `${Date.now()}-${safeName}`;
                const { error: uploadError } = await supabase.storage
                    .from('eventos')
                    .upload(path, optimizedFile, {
                        upsert: true,
                        contentType: optimizedFile.type,
                    });
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage.from('eventos').getPublicUrl(path);
                imagen_url = urlData.publicUrl;
                setUploadingImage(false);
            }

            // Reintenta con el próximo correlativo si otra alta en paralelo se llevó
            // puesto el mismo slug (colisión detectada por el UNIQUE de la base).
            let slug = await generateUniqueSlug(localidad, fecha_inicio, tipo);
            let eventData = null;
            let eventError = null;

            for (let intento = 0; intento < 5; intento++) {
                const res = await supabase
                    .from('events')
                    .insert({
                        nombre: nombre?.trim() ? nombre.trim() : null,
                        fecha_inicio,
                        fecha_fin,
                        localidad,
                        hora_inicio: hora_inicio || null,
                        direccion: direccion || null,
                        ubicacion_url: ubicacion_url || null,
                        slug,
                        imagen_url,
                        tipo,
                        visible_en_home,
                        fecha_cierre_inscripcion: fecha_cierre_inscripcion
                            ? new Date(fecha_cierre_inscripcion).toISOString()
                            : null,
                        edad_minima: edadMinimaNum,
                        edad_maxima: edadMaximaNum,
                        modo_seleccion_juegos,
                        // El máximo de juegos solo tiene sentido bajo modo 'libre'.
                        // Se guarda null explícito en 'clasificado' aunque haya
                        // quedado algún valor cargado en el input mientras estaba
                        // oculto, para que el dato persistido sea siempre consistente.
                        max_juegos_por_participante: modo_seleccion_juegos === 'libre' ? maxJuegosNum : null,
                    })
                    .select()
                    .single();

                if (!res.error) {
                    eventData = res.data;
                    eventError = null;
                    break;
                }

                const esColisionDeSlug = res.error.code === '23505';
                if (!esColisionDeSlug) {
                    eventError = res.error;
                    break;
                }

                eventError = res.error;
                slug = await generateUniqueSlug(localidad, fecha_inicio, tipo);
            }

            if (eventError) throw eventError;
            if (!eventData) throw new Error("No se recibieron datos.");

            if (!esPresentacion) {
                const { data: eventGamesData, error: gameInsertError } = await supabase
                    .from("event_games")
                    .insert(selectedGames.map(gameId => {
                        const game = games.find(g => g.id === gameId);
                        return {
                            game_id: gameId,
                            event_id: eventData.id,
                            // Un juego sin team_option solo puede jugarse individual,
                            // sin importar qué haya quedado seleccionado en el UI.
                            registration_mode: game?.team_option ? (gameModes[gameId] ?? 'both') : 'individual',
                            cupo_maximo: gameCupos[gameId] === '' || gameCupos[gameId] == null
                                ? null
                                : Number(gameCupos[gameId]),
                        };
                    }))
                    .select();

                if (gameInsertError) throw gameInsertError;

                if (isMultiDay && eventGamesData?.length > 0) {
                    const daysToInsert = [];
                    for (const eg of eventGamesData) {
                        const selectedDays = getEffectiveDays(eg.game_id);
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
            }

            const link = `${BASE_URL}/formulario/${slug}`;
            setSavedLink(link);
            setSuccessMessage(`Evento creado con éxito.`);
            onSuccess?.(slug);
        } catch (err) {
            setUploadingImage(false);
            const msg = err?.message || err?.error_description || JSON.stringify(err);
            console.error("Error al guardar evento:", msg, err);
            setErrorMessage(`Error: ${msg}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="filters-container">
            <h3>Nuevo Evento</h3>
            <form onSubmit={handleSubmit}>

                <div className="filter-group">
                    <label className="filter-label">Tipo de evento: *</label>
                    <select
                        name="tipo"
                        value={formValues.tipo}
                        onChange={handleInputChange}
                        className="filter-select"
                    >
                        <option value="torneo">Torneo</option>
                        <option value="presentacion">Presentación</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            name="visible_en_home"
                            checked={formValues.visible_en_home}
                            onChange={handleInputChange}
                        />
                        Visible en la home
                    </label>
                </div>

                <div className="filter-group">
                    <label className="filter-label">Nombre del evento (opcional):</label>
                    <input
                        type="text"
                        name="nombre"
                        value={formValues.nombre}
                        onChange={handleInputChange}
                        className="filter-select"
                        placeholder="Ej: San Fernando Gamers"
                    />
                </div>

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
                    <label className="filter-label">Fecha/hora límite de inscripción:</label>
                    <input
                        type="datetime-local"
                        name="fecha_cierre_inscripcion"
                        value={formValues.fecha_cierre_inscripcion}
                        onChange={handleInputChange}
                        className="filter-date"
                    />
                </div>

                <div className="filter-group">
                    <label className="filter-label">Edad mínima (opcional):</label>
                    <input
                        type="number"
                        min="0"
                        name="edad_minima"
                        value={formValues.edad_minima}
                        onChange={handleInputChange}
                        className="filter-select"
                        placeholder="Sin límite"
                    />
                </div>

                <div className="filter-group">
                    <label className="filter-label">Edad máxima (opcional):</label>
                    <input
                        type="number"
                        min="0"
                        name="edad_maxima"
                        value={formValues.edad_maxima}
                        onChange={handleInputChange}
                        className="filter-select"
                        placeholder="Sin límite"
                    />
                </div>

                <div className="filter-group">
                    <label className="filter-label">Modo de selección de juegos:</label>
                    <select
                        name="modo_seleccion_juegos"
                        value={formValues.modo_seleccion_juegos}
                        onChange={handleInputChange}
                        className="filter-select"
                    >
                        <option value="clasificado">Clasificado (principal / secundario)</option>
                        <option value="libre">Libre (todos los juegos por igual)</option>
                    </select>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
                        “Clasificado” mantiene el comportamiento actual (1 juego principal + secundarios).
                        “Libre” permite inscribirse a cualquier combinación de juegos, sin distinción.
                    </p>
                </div>

                {formValues.modo_seleccion_juegos === 'libre' && (
                    <div className="filter-group">
                        <label className="filter-label">Máximo de juegos por participante (opcional):</label>
                        <input
                            type="number"
                            min="1"
                            name="max_juegos_por_participante"
                            value={formValues.max_juegos_por_participante}
                            onChange={handleInputChange}
                            className="filter-select"
                            placeholder="Sin límite"
                        />
                    </div>
                )}

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
                        accept="image/jpeg,image/png,image/webp"
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

                {!esPresentacion && (
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

                                            {isSelected && game.team_option && (
                                                <select
                                                    value={gameModes[game.id] ?? 'both'}
                                                    onChange={(e) => handleModeChange(game.id, e.target.value)}
                                                    className="filter-select"
                                                    style={{ marginLeft: '1.5rem', width: 'auto', fontSize: '0.83rem' }}
                                                >
                                                    <option value="individual">Individual</option>
                                                    <option value="team">Solo equipos</option>
                                                    <option value="both">Individual o equipos</option>
                                                </select>
                                            )}

                                            {isSelected && (
                                                <label style={{ marginLeft: '1.5rem', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    Cupo máximo:
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={gameCupos[game.id] ?? ''}
                                                        onChange={(e) => handleCupoChange(game.id, e.target.value)}
                                                        className="filter-select"
                                                        style={{ width: '90px' }}
                                                        placeholder="Sin límite"
                                                    />
                                                </label>
                                            )}

                                            {isSelected && isMultiDay && (
                                                <GameDaysSelector
                                                    eventDates={eventDates}
                                                    selectedDays={effectiveDays}
                                                    onToggle={(date) => handleDayToggle(game.id, date)}
                                                />
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                !loadingGames && !errorGames && <p>No hay juegos disponibles.</p>
                            )}
                        </div>
                    </div>
                )}

                {errorMessage && <p className="error-message-admin">{errorMessage}</p>}
                {successMessage && <p className="success-message-admin">{successMessage}</p>}

                {savedLink && (
                    <div className="inscription-link-box" style={{ marginTop: '0.5rem' }}>
                        <span>{savedLink}</span>
                        <button type="button" className="btn-copy" onClick={copyLink}>
                            {copied ? '¡Copiado!' : 'Copiar'}
                        </button>
                    </div>
                )}

                <button
                    type="submit"
                    className="export-button"
                    disabled={uploadingImage || submitting}
                    style={{ opacity: (uploadingImage || submitting) ? 0.6 : 1 }}
                >
                    {uploadingImage ? 'Subiendo imagen...' : submitting ? 'Guardando…' : 'Guardar evento'}
                </button>
            </form>
        </div>
    );
};

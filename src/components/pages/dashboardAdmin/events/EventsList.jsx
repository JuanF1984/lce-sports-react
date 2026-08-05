import { useEffect, useState } from 'react';
import { useEvents } from '../../../../hooks/useEvents';
import { useEventGames } from '../../../../hooks/useEventGames';
import { useGames } from '../../../../hooks/useGames';
import supabase from '../../../../utils/supabase';
import { AddTournamentForm } from './AddTournamentForm';
import { localidadesBuenosAires } from '../../../../data/localidades';
import { getEffectiveRegistrationMode } from '../../../../utils/registrationMode';

const BASE_URL = 'https://lcesports.com.ar';

const isoToDatetimeLocal = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Relación real entre una inscripción y el juego dentro de un evento puntual:
// inscriptions.id_evento = events.id, y games_inscriptions (id_inscription, id_game)
// conecta esa inscripción con el juego. No hay una columna que apunte directo de
// games_inscriptions a event_games, así que hay que pasar por inscriptions.
// Devuelve el set de game_id que ya tienen al menos una inscripción para ese evento.
const getGamesConInscripcionesDelEvento = async (eventId) => {
    const { data: inscripcionesDelEvento, error: errInscripciones } = await supabase
        .from('inscriptions')
        .select('id')
        .eq('id_evento', eventId);
    if (errInscripciones) throw errInscripciones;

    const inscripcionIds = (inscripcionesDelEvento || []).map(i => i.id);
    if (inscripcionIds.length === 0) return new Set();

    const { data: gamesInscriptions, error: errGamesInscripciones } = await supabase
        .from('games_inscriptions')
        .select('id_game')
        .in('id_inscription', inscripcionIds);
    if (errGamesInscripciones) throw errGamesInscripciones;

    return new Set((gamesInscriptions || []).map(r => r.id_game));
};

// Chequeo autoritativo de "¿este evento ya tiene alguna inscripción?", usado
// como defensa en profundidad al guardar (independiente de `tieneInscripciones`,
// que es solo la foto precargada para la UI — ver el comentario en el efecto
// que la calcula, más abajo). Mismo patrón que `handleDeleteEvent`: alcanza con
// saber que existe al menos una fila, no hace falta contar el total.
const eventoTieneInscripciones = async (eventId) => {
    const { data, error } = await supabase
        .from('inscriptions')
        .select('id')
        .eq('id_evento', eventId)
        .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
};

const EditEventModal = ({
    event,
    initialGames,
    initialGameModes,
    games,
    loadingGames,
    errorGames,
    isSaving,
    onSave,
    onCancel,
    gamesConInscripciones,
    verificandoInscripciones,
    errorVerificandoInscripciones,
    tieneInscripcionesEvento,
}) => {
    const [form, setForm] = useState({
        nombre: event.nombre || '',
        fecha_inicio: event.fecha_inicio,
        fecha_fin: event.fecha_fin,
        localidad: event.localidad,
        ubicacion_url: event.ubicacion_url || '',
        inscripciones_abiertas: event.inscripciones_abiertas ?? true,
        tipo: event.tipo || 'torneo',
        visible_en_home: event.visible_en_home ?? true,
        fecha_cierre_inscripcion: isoToDatetimeLocal(event.fecha_cierre_inscripcion),
        edad_minima: event.edad_minima ?? '',
        edad_maxima: event.edad_maxima ?? '',
        modo_seleccion_juegos: event.modo_seleccion_juegos || 'clasificado',
        max_juegos_por_participante: event.max_juegos_por_participante ?? '',
    });
    const [selectedGames, setSelectedGames] = useState(initialGames);
    const [gameModes, setGameModes] = useState(initialGameModes);
    const [reglasError, setReglasError] = useState('');

    const esPresentacion = form.tipo === 'presentacion';
    // Los 4 campos de reglas (edad mín/máx, modo de selección, máximo de
    // juegos) quedan de solo lectura una vez que el evento tiene alguna
    // inscripción — mismo criterio conservador ya usado para `tipo` y
    // `registration_mode`: cambiar estas reglas después de que alguien ya se
    // inscribió podría invalidar datos ya cargados (p. ej. bajar la edad
    // máxima por debajo de la edad de alguien que ya se anotó).
    const reglasBloqueadas = tieneInscripcionesEvento === true;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        // 'tipo' es inmutable una vez creado el evento: no tiene campo editable
        // (ver el <select disabled> más abajo), así que nunca llega acá.
        setForm(prev => ({ ...prev, [name]: newValue }));
    };

    const validarReglas = () => {
        if (reglasBloqueadas) return true; // los campos están disabled, no hay nada que validar

        const edadMinimaNum = form.edad_minima !== '' ? Number(form.edad_minima) : null;
        const edadMaximaNum = form.edad_maxima !== '' ? Number(form.edad_maxima) : null;
        const maxJuegosNum = form.max_juegos_por_participante !== '' ? Number(form.max_juegos_por_participante) : null;

        if (edadMinimaNum !== null && edadMinimaNum < 0) {
            setReglasError('La edad mínima no puede ser negativa.');
            return false;
        }
        if (edadMaximaNum !== null && edadMaximaNum < 0) {
            setReglasError('La edad máxima no puede ser negativa.');
            return false;
        }
        if (edadMinimaNum !== null && edadMaximaNum !== null && edadMinimaNum > edadMaximaNum) {
            setReglasError('La edad mínima no puede ser mayor que la edad máxima.');
            return false;
        }
        if (form.modo_seleccion_juegos === 'libre' && maxJuegosNum !== null && maxJuegosNum < 1) {
            setReglasError('El máximo de juegos por participante debe ser al menos 1 (o dejarse vacío para no limitarlo).');
            return false;
        }
        setReglasError('');
        return true;
    };

    const toggleGame = (gameId) => {
        setSelectedGames(prev =>
            prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
        );
    };

    const handleModeChange = (gameId, mode) => {
        setGameModes(prev => ({ ...prev, [gameId]: mode }));
    };

    const localidadesOptions = localidadesBuenosAires.map(l => ({ value: l, label: l }));

    return (
        <div className="event-edit-overlay" onClick={onCancel}>
            <div className="event-edit-modal" onClick={e => e.stopPropagation()}>
                <div className="event-edit-header">
                    <h3 className="event-edit-title">Modificar evento</h3>
                    <button className="event-edit-close" onClick={onCancel} aria-label="Cerrar">×</button>
                </div>

                <div className="event-edit-body">
                    {/* Tipo + visibilidad */}
                    <div className="event-edit-section">
                        <div className="event-edit-field">
                            <label className="event-edit-label">Tipo de evento</label>
                            <select
                                name="tipo"
                                value={form.tipo}
                                disabled
                                className="event-edit-select"
                                title="El tipo de evento no se puede modificar después de creado"
                            >
                                <option value="torneo">Torneo</option>
                                <option value="presentacion">Presentación</option>
                            </select>
                            <p className="event-edit-hint">
                                No se puede modificar después de creado. Si es incorrecto, eliminá el evento (si no tiene inscripciones) y creá uno nuevo.
                            </p>
                        </div>
                        <div className="event-edit-field event-edit-field--center">
                            <label className="event-edit-checkbox-label">
                                <input
                                    type="checkbox"
                                    name="visible_en_home"
                                    checked={form.visible_en_home}
                                    onChange={handleChange}
                                />
                                Visible en la home
                            </label>
                        </div>
                    </div>

                    {/* Fechas */}
                    <div className="event-edit-section">
                        <div className="event-edit-field">
                            <label className="event-edit-label">Fecha de inicio</label>
                            <input type="date" name="fecha_inicio" value={form.fecha_inicio} onChange={handleChange} className="event-edit-input" />
                        </div>
                        <div className="event-edit-field">
                            <label className="event-edit-label">Fecha de finalización</label>
                            <input type="date" name="fecha_fin" value={form.fecha_fin} onChange={handleChange} className="event-edit-input" />
                        </div>
                    </div>

                    {/* Nombre propio del evento */}
                    <div className="event-edit-section">
                        <div className="event-edit-field event-edit-field--full">
                            <label className="event-edit-label">Nombre del evento (opcional)</label>
                            <input
                                type="text"
                                name="nombre"
                                value={form.nombre}
                                onChange={handleChange}
                                className="event-edit-input"
                                placeholder="Ej: San Fernando Gamers"
                            />
                        </div>
                    </div>

                    {/* Localidad + Maps */}
                    <div className="event-edit-section">
                        <div className="event-edit-field">
                            <label className="event-edit-label">Localidad</label>
                            <select name="localidad" value={form.localidad} onChange={handleChange} className="event-edit-select">
                                <option value="">Seleccioná una localidad</option>
                                {localidadesOptions.map((l, i) => (
                                    <option key={i} value={l.value}>{l.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="event-edit-field">
                            <label className="event-edit-label">URL Google Maps</label>
                            <input
                                type="text"
                                name="ubicacion_url"
                                value={form.ubicacion_url}
                                onChange={handleChange}
                                className="event-edit-input"
                                placeholder="https://maps.google.com/..."
                            />
                        </div>
                    </div>

                    {/* Inscripciones */}
                    <div className="event-edit-section">
                        <div className="event-edit-field event-edit-field--center">
                            <label className="event-edit-checkbox-label">
                                <input
                                    type="checkbox"
                                    name="inscripciones_abiertas"
                                    checked={form.inscripciones_abiertas}
                                    onChange={handleChange}
                                />
                                Inscripciones abiertas
                            </label>
                        </div>
                        <div className="event-edit-field">
                            <label className="event-edit-label">Cierre anticipado (opcional)</label>
                            <input
                                type="datetime-local"
                                name="fecha_cierre_inscripcion"
                                value={form.fecha_cierre_inscripcion}
                                onChange={handleChange}
                                className="event-edit-input"
                            />
                        </div>
                    </div>

                    {/* Reglas de participación: edad y modo de selección de juegos */}
                    <div className="event-edit-section">
                        <div className="event-edit-field">
                            <label className="event-edit-label">Edad mínima (opcional)</label>
                            <input
                                type="number"
                                min="0"
                                name="edad_minima"
                                value={form.edad_minima}
                                onChange={handleChange}
                                disabled={reglasBloqueadas}
                                className="event-edit-input"
                                placeholder="Sin límite"
                            />
                        </div>
                        <div className="event-edit-field">
                            <label className="event-edit-label">Edad máxima (opcional)</label>
                            <input
                                type="number"
                                min="0"
                                name="edad_maxima"
                                value={form.edad_maxima}
                                onChange={handleChange}
                                disabled={reglasBloqueadas}
                                className="event-edit-input"
                                placeholder="Sin límite"
                            />
                        </div>
                    </div>

                    <div className="event-edit-section">
                        <div className="event-edit-field">
                            <label className="event-edit-label">Modo de selección de juegos</label>
                            <select
                                name="modo_seleccion_juegos"
                                value={form.modo_seleccion_juegos}
                                onChange={handleChange}
                                disabled={reglasBloqueadas}
                                className="event-edit-select"
                            >
                                <option value="clasificado">Clasificado (principal / secundario)</option>
                                <option value="libre">Libre (todos los juegos por igual)</option>
                            </select>
                        </div>
                        {form.modo_seleccion_juegos === 'libre' && (
                            <div className="event-edit-field">
                                <label className="event-edit-label">Máximo de juegos por participante</label>
                                <input
                                    type="number"
                                    min="1"
                                    name="max_juegos_por_participante"
                                    value={form.max_juegos_por_participante}
                                    onChange={handleChange}
                                    disabled={reglasBloqueadas}
                                    className="event-edit-input"
                                    placeholder="Sin límite"
                                />
                            </div>
                        )}
                    </div>

                    {reglasBloqueadas && (
                        <p className="event-edit-hint">
                            Este evento ya tiene inscripciones asociadas: la edad mínima/máxima, el modo de
                            selección de juegos y el máximo de juegos por participante no se pueden modificar.
                        </p>
                    )}
                    {reglasError && <p className="event-edit-error">{reglasError}</p>}

                    {/* Juegos */}
                    {!esPresentacion ? (
                        <div className="event-edit-field event-edit-field--full">
                            <label className="event-edit-label">Juegos</label>
                            {loadingGames && <p className="event-edit-hint">Cargando juegos...</p>}
                            {errorGames && <p className="event-edit-error">Error al cargar juegos</p>}
                            {errorVerificandoInscripciones && (
                                <p className="event-edit-error">
                                    No se pudo verificar si estos juegos ya tienen inscripciones asociadas.
                                    Por seguridad, no se pueden quitar juegos ni editar su modalidad ahora — cerrá y volvé a intentar.
                                </p>
                            )}
                            {!loadingGames && !errorGames && (
                                <div className="event-edit-games">
                                    {games?.map(game => {
                                        const isSelected = selectedGames.includes(game.id);
                                        // Fail-closed: mientras no se confirmó que el juego NO tiene
                                        // inscripciones (todavía verificando, o la verificación falló),
                                        // se trata como si las tuviera — ni se puede quitar del evento
                                        // ni cambiar su modalidad.
                                        const bloqueadoPorInscripciones = verificandoInscripciones
                                            || errorVerificandoInscripciones
                                            || gamesConInscripciones?.has(game.id);
                                        return (
                                            <div key={game.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                                <label className="event-edit-game-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleGame(game.id)}
                                                        disabled={isSelected && bloqueadoPorInscripciones}
                                                        title={isSelected && gamesConInscripciones?.has(game.id)
                                                            ? 'No se puede quitar este juego porque ya tiene inscripciones asociadas.'
                                                            : isSelected && (verificandoInscripciones || errorVerificandoInscripciones)
                                                                ? 'Verificando inscripciones…'
                                                                : undefined}
                                                    />
                                                    {game.game_name}
                                                </label>
                                                {isSelected && game.team_option && (
                                                    <select
                                                        value={gameModes[game.id] ?? 'both'}
                                                        onChange={(e) => handleModeChange(game.id, e.target.value)}
                                                        disabled={bloqueadoPorInscripciones}
                                                        className="event-edit-select"
                                                        style={{ marginLeft: '1.5rem', width: 'auto', fontSize: '0.83rem' }}
                                                        title={gamesConInscripciones?.has(game.id)
                                                            ? 'Este juego ya tiene inscripciones asociadas: la modalidad no se puede modificar.'
                                                            : verificandoInscripciones
                                                                ? 'Verificando inscripciones…'
                                                                : undefined}
                                                    >
                                                        <option value="individual">Individual</option>
                                                        <option value="team">Solo equipos</option>
                                                        <option value="both">Individual o equipos</option>
                                                    </select>
                                                )}
                                                {isSelected && gamesConInscripciones?.has(game.id) && (
                                                    <span className="event-edit-hint" style={{ marginLeft: '1.5rem' }}>
                                                        No se puede quitar este juego porque ya tiene inscripciones asociadas
                                                        {game.team_option ? ' ni cambiar su modalidad.' : '.'}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="event-edit-field event-edit-field--full">
                            <p className="event-edit-hint">Las presentaciones no tienen juegos asociados.</p>
                        </div>
                    )}
                </div>

                <div className="event-edit-footer">
                    <button className="cancel-button" onClick={onCancel} disabled={isSaving}>
                        Cancelar
                    </button>
                    <button
                        className="export-button"
                        onClick={() => { if (validarReglas()) onSave(form, selectedGames, gameModes); }}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const EventsList = () => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const { eventsData, eventsError, eventsLoading, setEventsData } = useEvents();
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [localEventGames, setLocalEventGames] = useState({});
    const [inscriptionLink, setInscriptionLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [tieneInscripciones, setTieneInscripciones] = useState({}); // { [eventId]: boolean } — solo para mostrar en la UI
    const [deletingId, setDeletingId] = useState(null);
    const [gamesConInscripcionesEditar, setGamesConInscripcionesEditar] = useState(new Set());
    const [verificandoInscripciones, setVerificandoInscripciones] = useState(false);
    const [errorVerificandoInscripciones, setErrorVerificandoInscripciones] = useState(false);

    const anyModalOpen = showCreateModal || !!editingEvent;
    useEffect(() => {
        document.body.style.overflow = anyModalOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [anyModalOpen]);

    const eventIds = eventsData?.map(e => e.id) || [];
    const { eventGames, loading: loadingEventGames, error: errorEventGames } = useEventGames(eventIds);
    const { games, loading: loadingGames, error: errorGames } = useGames();

    useEffect(() => {
        if (eventGames && Object.keys(eventGames).length > 0) {
            setLocalEventGames(eventGames);
        }
    }, [eventGames]);

    // Trae, para cada evento listado, si tiene al menos una inscripción asociada.
    // Es solo para que la UI deje claro qué eventos son borrables — la validación
    // real y autoritativa se vuelve a hacer justo antes del DELETE, en handleDeleteEvent.
    //
    // Paginado por cursor a propósito: sin esto, con muchas inscripciones históricas
    // acumuladas Supabase trunca la respuesta a su límite de filas por request y
    // eventos viejos con inscripciones reales terminaban mostrando "No" acá (mismo
    // problema que ya se resolvió con este patrón en InscriptionsList.jsx / EmailMasivo.jsx).
    useEffect(() => {
        const fetchInscripcionesFlags = async () => {
            if (eventIds.length === 0) return;

            const BATCH = 1000;
            const conInscripciones = new Set();
            let cursor = null;

            // eslint-disable-next-line no-constant-condition
            while (true) {
                let q = supabase
                    .from('inscriptions')
                    .select('id, id_evento')
                    .in('id_evento', eventIds)
                    .order('id', { ascending: true })
                    .limit(BATCH);

                if (cursor) q = q.gt('id', cursor);

                const { data, error } = await q;

                if (error) {
                    console.error('Error al verificar inscripciones por evento:', error);
                    return;
                }
                if (!data || data.length === 0) break;

                data.forEach(r => conInscripciones.add(r.id_evento));

                if (data.length < BATCH) break;
                cursor = data[data.length - 1].id;
            }

            setTieneInscripciones(
                Object.fromEntries(eventIds.map(id => [id, conInscripciones.has(id)]))
            );
        };
        fetchInscripcionesFlags();
    }, [JSON.stringify(eventIds)]);

    const saveChanges = async (form, selectedGames, gameModes) => {
        if (isSaving || !editingEvent) return;
        setIsSaving(true);

        try {
            // Reglas de edad / modo de selección de juegos / máximo de juegos:
            // si el evento ya tiene inscripciones, estos 4 campos no se pueden
            // tocar. Chequeo autoritativo e independiente de lo que ya haya
            // bloqueado la UI (mismo patrón de defensa en profundidad que el
            // resto de este archivo) — se repite acá porque puede haber pasado
            // tiempo entre abrir el modal y guardar.
            const normalizar = (v) => (v === '' || v === undefined ? null : v);
            const reglasCambiaron =
                normalizar(form.edad_minima) != normalizar(editingEvent.edad_minima) ||
                normalizar(form.edad_maxima) != normalizar(editingEvent.edad_maxima) ||
                (form.modo_seleccion_juegos || 'clasificado') !== (editingEvent.modo_seleccion_juegos || 'clasificado') ||
                normalizar(form.max_juegos_por_participante) != normalizar(editingEvent.max_juegos_por_participante);

            if (reglasCambiaron) {
                let tieneInscripcionesAhora;
                try {
                    tieneInscripcionesAhora = await eventoTieneInscripciones(editingEvent.id);
                } catch (err) {
                    console.error('Error al verificar inscripciones antes de guardar reglas del evento:', err);
                    // Fail-closed: si no se puede confirmar que el evento NO
                    // tiene inscripciones, se trata como si las tuviera.
                    tieneInscripcionesAhora = true;
                }

                if (tieneInscripcionesAhora) {
                    setMessage({
                        type: 'error',
                        text: 'No se pueden modificar la edad mínima/máxima, el modo de selección de juegos ni el máximo de juegos porque el evento ya tiene inscripciones asociadas.',
                    });
                    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
                    setIsSaving(false);
                    return;
                }
            }

            // Freno de seguridad, independiente de lo que ya haya filtrado la UI del
            // modal (gamesConInscripcionesEditar): puede haber pasado tiempo entre
            // abrir el modal y guardar, así que se vuelve a comprobar acá, en el
            // momento real del guardado, cuáles de los juegos seleccionados ya
            // tienen inscripciones — y si alguno de ésos cambió de modalidad, se
            // frena TODO el guardado (no se aplica ningún cambio parcial).
            if (form.tipo !== 'presentacion') {
                const gamesConInscripciones = await getGamesConInscripcionesDelEvento(editingEvent.id);
                const juegosActuales = localEventGames[editingEvent.id] || [];

                const gameIdBloqueado = selectedGames.find(gameId => {
                    if (!gamesConInscripciones.has(gameId)) return false;
                    const game = games.find(g => g.id === gameId);
                    const modoNuevo = game?.team_option ? (gameModes[gameId] ?? 'both') : 'individual';
                    const juegoActual = juegosActuales.find(g => g.id === gameId);
                    const modoActual = getEffectiveRegistrationMode(juegoActual || {});
                    return modoNuevo !== modoActual;
                });

                if (gameIdBloqueado) {
                    const nombreJuego = games.find(g => g.id === gameIdBloqueado)?.game_name || 'este juego';
                    setMessage({
                        type: 'error',
                        text: `No se puede modificar la modalidad de "${nombreJuego}" porque ya tiene inscripciones asociadas.`,
                    });
                    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
                    setIsSaving(false);
                    return;
                }

                // Mismo freno, para juegos que se están quitando del evento (destildados):
                // si alguno de los que ya estaban asociados y ya tiene inscripciones no
                // figura en selectedGames, se frena TODO el guardado.
                const gameIdNoSePuedeQuitar = juegosActuales
                    .map(g => g.id)
                    .find(gameId => !selectedGames.includes(gameId) && gamesConInscripciones.has(gameId));

                if (gameIdNoSePuedeQuitar) {
                    const nombreJuego = games.find(g => g.id === gameIdNoSePuedeQuitar)?.game_name
                        || juegosActuales.find(g => g.id === gameIdNoSePuedeQuitar)?.game_name
                        || 'este juego';
                    setMessage({
                        type: 'error',
                        text: `No se puede quitar "${nombreJuego}" del evento porque ya tiene inscripciones asociadas.`,
                    });
                    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
                    setIsSaving(false);
                    return;
                }
            }

            // 'tipo' se excluye a propósito del payload de update: es inmutable
            // después de creado el evento (el <select> de arriba ya está disabled,
            // esto es una segunda barrera por si algo llega a tocar form.tipo).
            const { tipo: _tipoInmutable, ...formEditable } = form;
            const payload = {
                ...formEditable,
                nombre: form.nombre?.trim() ? form.nombre.trim() : '',
                fecha_cierre_inscripcion: form.fecha_cierre_inscripcion
                    ? new Date(form.fecha_cierre_inscripcion).toISOString()
                    : null,
                edad_minima: form.edad_minima !== '' ? Number(form.edad_minima) : null,
                edad_maxima: form.edad_maxima !== '' ? Number(form.edad_maxima) : null,
                max_juegos_por_participante: form.modo_seleccion_juegos === 'libre' && form.max_juegos_por_participante !== ''
                    ? Number(form.max_juegos_por_participante)
                    : null,
            };

            const { error: eventError } = await supabase
                .from('events')
                .update(payload)
                .eq('id', editingEvent.id);
            if (eventError) throw eventError;

            const { error: deleteError } = await supabase
                .from('event_games')
                .delete()
                .eq('event_id', editingEvent.id);
            if (deleteError) throw deleteError;

            if (form.tipo !== 'presentacion' && selectedGames.length > 0) {
                const { error: insertError } = await supabase
                    .from('event_games')
                    .insert(selectedGames.map(gameId => {
                        const game = games.find(g => g.id === gameId);
                        return {
                            event_id: editingEvent.id,
                            game_id: gameId,
                            registration_mode: game?.team_option ? (gameModes[gameId] ?? 'both') : 'individual',
                        };
                    }));
                if (insertError) throw insertError;
            }

            setEventsData(prev => prev.map(e => e.id === editingEvent.id ? { ...e, ...payload } : e));

            setLocalEventGames(prev => ({
                ...prev,
                [editingEvent.id]: games
                    .filter(g => selectedGames.includes(g.id))
                    .map(g => ({
                        id: g.id,
                        game_name: g.game_name,
                        team_option: g.team_option,
                        registration_mode: g.team_option ? (gameModes[g.id] ?? 'both') : 'individual',
                    })),
            }));

            if (editingEvent.slug) {
                setInscriptionLink(`${BASE_URL}/formulario/${editingEvent.slug}`);
            }

            setEditingEvent(null);
            setMessage({ type: 'success', text: 'Evento actualizado correctamente' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (err) {
            console.error('Error al actualizar:', err);
            setMessage({ type: 'error', text: 'Error al guardar los cambios' });
        } finally {
            setIsSaving(false);
        }
    };

    // Antes de habilitar la edición de modalidad por juego, hay que saber cuáles
    // de los juegos de ESTE evento ya tienen inscripciones (ver
    // getGamesConInscripcionesDelEvento). Si la verificación falla, no se sabe si
    // es seguro editar — por eso se bloquea todo el selector de modalidad
    // (errorVerificandoInscripciones) en vez de asumir que no hay inscripciones.
    const abrirEdicion = async (event) => {
        setEditingEvent(event);
        setGamesConInscripcionesEditar(new Set());
        setErrorVerificandoInscripciones(false);
        setVerificandoInscripciones(true);
        try {
            const set = await getGamesConInscripcionesDelEvento(event.id);
            setGamesConInscripcionesEditar(set);
        } catch (err) {
            console.error('Error al verificar inscripciones por juego antes de editar:', err);
            setErrorVerificandoInscripciones(true);
        } finally {
            setVerificandoInscripciones(false);
        }
    };

    const cerrarTodasPresentaciones = async () => {
        if (!window.confirm('¿Cerrar las inscripciones de todas las presentaciones?')) return;
        const { error } = await supabase
            .from('events')
            .update({ inscripciones_abiertas: false })
            .eq('tipo', 'presentacion');
        if (error) {
            setMessage({ type: 'error', text: 'Error al cerrar inscripciones' });
        } else {
            setEventsData(prev => prev.map(e =>
                e.tipo === 'presentacion' ? { ...e, inscripciones_abiertas: false } : e
            ));
            setMessage({ type: 'success', text: 'Inscripciones de todas las presentaciones cerradas' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

    // Elimina un evento SOLO si no tiene inscripciones asociadas. La comprobación
    // se hace acá, contra la base, en el momento real del borrado — no alcanza con
    // deshabilitar el botón en la UI (eso es sólo una ayuda visual, ver tieneInscripciones).
    const handleDeleteEvent = async (event) => {
        if (deletingId) return;
        setDeletingId(event.id);

        try {
            const { data: inscripcionesExistentes, error: checkError } = await supabase
                .from('inscriptions')
                .select('id')
                .eq('id_evento', event.id)
                .limit(1);

            if (checkError) throw checkError;

            if (inscripcionesExistentes && inscripcionesExistentes.length > 0) {
                setMessage({ type: 'error', text: 'No se puede eliminar este evento porque tiene inscripciones asociadas.' });
                setTimeout(() => setMessage({ type: '', text: '' }), 4000);
                return;
            }

            if (!window.confirm(`¿Eliminar el evento de ${event.localidad} (${event.fecha_inicio})? Esta acción no se puede deshacer.`)) {
                return;
            }

            const { error: deleteGamesError } = await supabase
                .from('event_games')
                .delete()
                .eq('event_id', event.id);
            if (deleteGamesError) throw deleteGamesError;

            const { error: deleteEventError } = await supabase
                .from('events')
                .delete()
                .eq('id', event.id);
            if (deleteEventError) throw deleteEventError;

            setEventsData(prev => prev.filter(e => e.id !== event.id));
            setLocalEventGames(prev => {
                const { [event.id]: _omit, ...rest } = prev;
                return rest;
            });
            setTieneInscripciones(prev => {
                const { [event.id]: _omit, ...rest } = prev;
                return rest;
            });
            setMessage({ type: 'success', text: 'Evento eliminado correctamente' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (err) {
            console.error('Error al eliminar evento:', err);
            setMessage({ type: 'error', text: 'Error al eliminar el evento' });
        } finally {
            setDeletingId(null);
        }
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(inscriptionLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (eventsLoading) return <div className="inscriptions-container">Cargando eventos...</div>;
    if (eventsError) return <div className="error-message-admin">Error al cargar eventos: {eventsError}</div>;

    return (
        <div className="inscriptions-container">
            <h2 className="titulos-admin">Lista de Eventos</h2>

            <div className="events-actions">
                <button className="export-button" onClick={() => setShowCreateModal(true)}>
                    Cargar Evento
                </button>
                <button className="btn-warning-outline" onClick={cerrarTodasPresentaciones}>
                    Cerrar inscripciones de presentaciones
                </button>
            </div>

            {message.text && (
                <div className={message.type === 'success' ? 'success-message-admin' : 'error-message-admin'}>
                    {message.text}
                </div>
            )}

            {inscriptionLink && (
                <div className="inscription-link-box">
                    <span>{inscriptionLink}</span>
                    <button type="button" className="btn-copy" onClick={copyLink}>
                        {copied ? '¡Copiado!' : 'Copiar'}
                    </button>
                </div>
            )}

            <div className="table-wrapper">
                <table className="inscriptions-table">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Fecha inicio</th>
                            <th>Fecha fin</th>
                            <th>Localidad</th>
                            <th>Cupos</th>
                            <th>Juegos</th>
                            <th>Inscriptos</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {eventsData?.map(event => (
                            <tr key={event.id}>
                                <td>
                                    <span className={`event-tipo-badge event-tipo-badge--${event.tipo === 'presentacion' ? 'presentacion' : 'torneo'}`}>
                                        {event.tipo === 'presentacion' ? 'Presentación' : 'Torneo'}
                                    </span>
                                </td>
                                <td>{new Date(event.fecha_inicio + 'T00:00:00').toLocaleDateString()}</td>
                                <td>{new Date(event.fecha_fin + 'T00:00:00').toLocaleDateString()}</td>
                                <td>
                                    {event.nombre ? (
                                        <>
                                            <strong>{event.nombre}</strong>
                                            <br />
                                            <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{event.localidad}</span>
                                        </>
                                    ) : event.localidad}
                                </td>
                                <td>
                                    <span className={`event-cupos-badge event-cupos-badge--${event.inscripciones_abiertas !== false ? 'abiertas' : 'cerradas'}`}>
                                        {event.inscripciones_abiertas !== false ? 'Abiertas' : 'Cerradas'}
                                    </span>
                                </td>
                                <td>
                                    {event.tipo === 'presentacion' ? (
                                        <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>—</span>
                                    ) : (
                                        <>
                                            {loadingEventGames && <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Cargando…</span>}
                                            {!loadingEventGames && !errorEventGames && localEventGames[event.id]?.length > 0 ? (
                                                <div className="games-tags-container">
                                                    {localEventGames[event.id].map(game => (
                                                        <span key={game.game_name} className="game-tag">{game.game_name}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                !loadingEventGames && <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Sin juegos</span>
                                            )}
                                        </>
                                    )}
                                </td>
                                <td>
                                    <span className={`event-cupos-badge event-cupos-badge--${tieneInscripciones[event.id] ? 'cerradas' : 'abiertas'}`}>
                                        {tieneInscripciones[event.id] ? 'Sí' : 'No'}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button
                                            className="export-button"
                                            style={{ margin: '0' }}
                                            onClick={() => abrirEdicion(event)}
                                        >
                                            Modificar
                                        </button>
                                        <button
                                            className="cancel-button"
                                            style={{ margin: '0' }}
                                            disabled={tieneInscripciones[event.id] === true || deletingId === event.id}
                                            title={tieneInscripciones[event.id]
                                                ? 'Este evento tiene inscripciones asociadas y no se puede eliminar'
                                                : 'Eliminar evento'}
                                            onClick={() => handleDeleteEvent(event)}
                                        >
                                            {deletingId === event.id ? 'Eliminando…' : 'Eliminar'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal: editar evento */}
            {editingEvent && (
                <EditEventModal
                    event={editingEvent}
                    initialGames={localEventGames[editingEvent.id]?.map(g => g.id) || []}
                    initialGameModes={Object.fromEntries(
                        (localEventGames[editingEvent.id] || []).map(g => [g.id, getEffectiveRegistrationMode(g)])
                    )}
                    games={games}
                    loadingGames={loadingGames}
                    errorGames={errorGames}
                    isSaving={isSaving}
                    onSave={saveChanges}
                    onCancel={() => setEditingEvent(null)}
                    gamesConInscripciones={gamesConInscripcionesEditar}
                    verificandoInscripciones={verificandoInscripciones}
                    errorVerificandoInscripciones={errorVerificandoInscripciones}
                    tieneInscripcionesEvento={tieneInscripciones[editingEvent.id]}
                />
            )}

            {/* Modal: crear evento */}
            {showCreateModal && (
                <div className="modal-torneo">
                    <button className="cancel-button" onClick={() => setShowCreateModal(false)}>Cerrar</button>
                    <AddTournamentForm
                        onSuccess={(slug) => {
                            if (slug) setInscriptionLink(`${BASE_URL}/formulario/${slug}`);
                            setMessage({ type: 'success', text: 'Evento creado con éxito.' });
                            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
                        }}
                    />
                </div>
            )}
        </div>
    );
};

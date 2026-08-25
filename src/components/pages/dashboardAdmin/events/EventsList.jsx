import { useEffect, useState } from 'react';
import { useEvents } from '../../../../hooks/useEvents';
import { useEventGames } from '../../../../hooks/useEventGames';
import { useGames } from '../../../../hooks/useGames';
import supabase from '../../../../utils/supabase';
import { AddTournamentForm } from './AddTournamentForm';
import { localidadesBuenosAires } from '../../../../data/localidades';
import { getEffectiveRegistrationMode } from '../../../../utils/registrationMode';
import { fetchEventGameCupos } from '../../../../utils/eventGameCupos';
import { getDatesInRange } from '../../../../utils/eventDays';
import { GameDaysSelector } from './GameDaysSelector';

const BASE_URL = 'https://lcesports.com.ar';

const isoToDatetimeLocal = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "¿Este juego ya tiene inscripciones dentro de este evento?" se responde
// hoy con ocupados > 0 de get_event_game_cupos (RPC SECURITY DEFINER, no
// depende de RLS sobre inscriptions/games_inscriptions, y no arma ningún
// .in() con IDs de inscripción — ver src/utils/eventGameCupos.js). Antes se
// resolvía con una consulta propia (SELECT de inscriptions + .in() sobre
// games_inscriptions) que podía romperse con un .in() de cientos/miles de
// UUIDs en eventos con mucho volumen; se retiró por duplicar exactamente lo
// mismo que ya calcula el RPC de cupos, sin ese riesgo.
const gamesConInscripcionesDesdeCupos = (cuposRows) =>
    new Set((cuposRows || []).filter(r => (r.ocupados ?? 0) > 0).map(r => r.game_id));

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
    initialGameCupos,
    initialGameDays,
    ocupadosPorJuego,
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
    // Cupo máximo por juego (event_games.cupo_maximo) — independiente de
    // gamesConInscripciones/registration_mode: a diferencia de esos dos, el
    // cupo SÍ se puede editar aunque el juego ya tenga inscripciones (ver
    // "Reducción del cupo" en docs/inscripciones.md) — bajar el cupo no
    // borra ni invalida a nadie, solo cierra el paso a inscripciones nuevas.
    const [gameCupos, setGameCupos] = useState(initialGameCupos);
    // Día(s) del evento en que se juega cada juego (event_games_days) —
    // mismo estado y misma convención que AddTournamentForm.jsx: si un
    // gameId no tiene entrada acá, se asume que juega todos los días del
    // evento (ver getEffectiveDays). Se inicializa con lo ya persistido para
    // los juegos existentes (initialGameDays, calculado en EventsList a
    // partir de `dias` de useEventGames); los juegos que se agreguen nuevos
    // durante esta edición caen en ese mismo default de "todos los días".
    const [gameDays, setGameDays] = useState(initialGameDays);
    const [reglasError, setReglasError] = useState('');

    const esPresentacion = form.tipo === 'presentacion';

    // Mismo criterio que AddTournamentForm.jsx: se recalcula sobre las fechas
    // actuales del formulario (no las originales del evento), así que si se
    // cambian las fechas en esta misma edición el selector de días reacciona
    // igual que en la carga inicial.
    const isMultiDay = Boolean(
        form.fecha_inicio &&
        form.fecha_fin &&
        form.fecha_inicio !== form.fecha_fin
    );
    const eventDates = isMultiDay ? getDatesInRange(form.fecha_inicio, form.fecha_fin) : [];
    const getEffectiveDays = (gameId) => gameDays[gameId] ?? eventDates;

    const handleDayToggle = (gameId, date) => {
        const current = getEffectiveDays(gameId);
        const next = current.includes(date)
            ? current.filter(d => d !== date)
            : [...current, date].sort();
        setGameDays(prev => ({ ...prev, [gameId]: next }));
    };

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

    const handleCupoChange = (gameId, value) => {
        setGameCupos(prev => ({ ...prev, [gameId]: value }));
    };

    // Validación de UI del cupo — la definitiva es el constraint
    // `cupo_maximo >= 0` de la base. A propósito NO bloquea el guardado
    // cuando el cupo ingresado es menor a los ya ocupados (ver el aviso
    // inline en el input): eso está permitido explícitamente, solo se avisa.
    const validarCupos = () => {
        for (const gameId of selectedGames) {
            const raw = gameCupos[gameId];
            if (raw === '' || raw == null) continue;
            const n = Number(raw);
            if (!Number.isInteger(n) || n < 0) {
                const nombreJuego = games.find(g => g.id === gameId)?.game_name || 'un juego';
                setReglasError(`El cupo de "${nombreJuego}" debe ser un número entero mayor o igual a 0 (o vacío para sin límite).`);
                return false;
            }
        }
        return true;
    };

    // Mismo chequeo que AddTournamentForm.jsx: en un evento de varios días,
    // todo juego seleccionado tiene que tener al menos un día marcado.
    const validarDias = () => {
        if (!isMultiDay) return true;
        for (const gameId of selectedGames) {
            if (getEffectiveDays(gameId).length === 0) {
                const nombreJuego = games.find(g => g.id === gameId)?.game_name || 'un juego';
                setReglasError(`El juego "${nombreJuego}" no tiene ningún día seleccionado.`);
                return false;
            }
        }
        return true;
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
                                                {isSelected && (() => {
                                                    const ocupados = ocupadosPorJuego?.[game.id] ?? 0;
                                                    const raw = gameCupos[game.id];
                                                    const cupoNuevo = raw === '' || raw == null ? null : Number(raw);
                                                    const sobreocupado = cupoNuevo !== null && Number.isInteger(cupoNuevo) && cupoNuevo < ocupados;
                                                    return (
                                                        <>
                                                            <label style={{ marginLeft: '1.5rem', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                Cupo máximo:
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="1"
                                                                    value={raw ?? ''}
                                                                    onChange={(e) => handleCupoChange(game.id, e.target.value)}
                                                                    className="event-edit-input"
                                                                    style={{ width: '90px' }}
                                                                    placeholder="Sin límite"
                                                                />
                                                                {ocupados > 0 && (
                                                                    <span style={{ color: '#6b7280' }}>({ocupados} ya inscriptos)</span>
                                                                )}
                                                            </label>
                                                            {sobreocupado && (
                                                                <span className="event-edit-hint" style={{ marginLeft: '1.5rem', color: '#b91c1c' }}>
                                                                    Atención: el cupo nuevo ({cupoNuevo}) es menor a la cantidad de personas ya
                                                                    inscriptas ({ocupados}). Se puede guardar igual — nadie se da de baja
                                                                    automáticamente — pero no se aceptarán inscripciones nuevas a este juego
                                                                    hasta que el cupo suba o baje la cantidad de inscriptos.
                                                                </span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                                {isSelected && isMultiDay && (
                                                    <GameDaysSelector
                                                        eventDates={eventDates}
                                                        selectedDays={getEffectiveDays(game.id)}
                                                        onToggle={(date) => handleDayToggle(game.id, date)}
                                                    />
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
                        onClick={() => { if (validarReglas() && validarCupos() && validarDias()) onSave(form, selectedGames, gameModes, gameCupos, gameDays); }}
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

    const anyModalOpen = showCreateModal || !!editingEvent;
    useEffect(() => {
        document.body.style.overflow = anyModalOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [anyModalOpen]);

    const eventIds = eventsData?.map(e => e.id) || [];
    const {
        eventGames,
        loading: loadingEventGames,
        error: errorEventGames,
        cuposError,
    } = useEventGames(eventIds);
    const { games, loading: loadingGames, error: errorGames } = useGames();

    // Estado de "¿se puede confiar en `ocupados` para saber si un juego tiene
    // inscripciones?" — ya no es un fetch aparte al abrir el modal (ver
    // abrirEdicion más abajo): se deriva directo del mismo hook que ya carga
    // la lista (useEventGames), reusando su `loading`/`error`/`cuposError` en
    // vez de duplicar la verificación. Mismo criterio fail-closed que antes:
    // mientras esté cargando O si falló, no se puede confiar en los datos.
    const verificandoInscripciones = loadingEventGames;
    const errorVerificandoInscripciones = !!errorEventGames || cuposError;

    // Juegos del evento en edición que ya tienen al menos una inscripción
    // (ocupados > 0) — derivado de `localEventGames`, que ya trae `ocupados`
    // por juego desde useEventGames/get_event_game_cupos. Si la verificación
    // no es confiable ahora mismo (errorVerificandoInscripciones), el propio
    // EditEventModal trata TODOS los juegos tildados como bloqueados
    // (bloqueadoPorInscripciones ya combina esto con gamesConInscripciones,
    // sin cambios en ese componente) — no hace falta ensuciar este Set con
    // "todos" para lograr el fail-closed.
    const gamesConInscripcionesEditar = editingEvent
        ? gamesConInscripcionesDesdeCupos(
            (localEventGames[editingEvent.id] || []).map(g => ({ game_id: g.id, ocupados: g.ocupados }))
        )
        : new Set();

    // Días por juego ya persistidos (event_games_days, vía `dias` de
    // useEventGames) para precargar el selector de días de EditEventModal.
    // `dias` vacío significa "juega todos los días" (mismo criterio que la
    // carga inicial en AddTournamentForm.jsx: ausencia de filas en
    // event_games_days = todos los días del evento) — se traduce acá a la
    // lista completa de fechas del evento para que los checkboxes arranquen
    // todos tildados, igual que en la carga inicial.
    const initialGameDaysEditar = editingEvent
        ? (() => {
            const esMultiDia = editingEvent.fecha_inicio !== editingEvent.fecha_fin;
            const fechasEvento = esMultiDia
                ? getDatesInRange(editingEvent.fecha_inicio, editingEvent.fecha_fin)
                : [];
            return Object.fromEntries(
                (localEventGames[editingEvent.id] || []).map(g => [
                    g.id,
                    (g.dias && g.dias.length > 0) ? g.dias : fechasEvento,
                ])
            );
        })()
        : {};

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

    const saveChanges = async (form, selectedGames, gameModes, gameCupos, gameDays) => {
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
            // abrir el modal y guardar (incluso alguien pudo haberse inscripto
            // recién), así que se vuelve a pedir el dato FRESCO acá, en el momento
            // real del guardado — no se reutiliza el `ocupados` que ya tenía
            // cargado `localEventGames` desde que se abrió el modal. Mismo RPC que
            // usa la lista (get_event_game_cupos), pedido de nuevo solo para este
            // evento puntual.
            if (form.tipo !== 'presentacion') {
                let cuposFrescos;
                try {
                    cuposFrescos = await fetchEventGameCupos([editingEvent.id]);
                } catch (err) {
                    console.error('Error al revalidar inscripciones antes de guardar juegos del evento:', err);
                    // Fail-closed: si no se puede confirmar en este momento cuáles
                    // juegos tienen inscripciones, no se guarda ningún cambio de
                    // juegos/modalidad (podría estar ocultando una inscripción
                    // nueva creada después de abrir el modal).
                    setMessage({
                        type: 'error',
                        text: 'No se pudo verificar si los juegos tienen inscripciones asociadas. Por seguridad, no se guardaron los cambios.',
                    });
                    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
                    setIsSaving(false);
                    return;
                }

                const gamesConInscripciones = gamesConInscripcionesDesdeCupos(cuposFrescos);
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

            // Días del evento editado, para reinsertar event_games_days —
            // mismo criterio que la carga inicial en AddTournamentForm.jsx:
            // se calcula sobre las fechas que se están guardando (form), no
            // las originales del evento.
            const eventoEditadoEsMultiDia = form.fecha_inicio !== form.fecha_fin;
            const eventDatesGuardado = eventoEditadoEsMultiDia
                ? getDatesInRange(form.fecha_inicio, form.fecha_fin)
                : [];

            if (form.tipo !== 'presentacion' && selectedGames.length > 0) {
                const { data: insertedGames, error: insertError } = await supabase
                    .from('event_games')
                    .insert(selectedGames.map(gameId => {
                        const game = games.find(g => g.id === gameId);
                        const rawCupo = gameCupos?.[gameId];
                        return {
                            event_id: editingEvent.id,
                            game_id: gameId,
                            registration_mode: game?.team_option ? (gameModes[gameId] ?? 'both') : 'individual',
                            // event_games se borra y reinserta completo en cada
                            // guardado (ver el delete de arriba) — cupo_maximo
                            // tiene que viajar acá siempre o se perdería en
                            // cualquier edición del evento, aunque no se haya
                            // tocado el cupo (mismo cuidado que ya existe para
                            // registration_mode).
                            cupo_maximo: rawCupo === '' || rawCupo == null ? null : Number(rawCupo),
                        };
                    }))
                    .select();
                if (insertError) throw insertError;

                // event_games_days también se borra en cascada junto con el
                // delete de event_games de arriba (event_game_id FK) — hay que
                // reinsertarlo acá para cada event_games recién creado, con la
                // misma convención que AddTournamentForm.jsx: si el juego
                // juega TODOS los días del evento no se inserta ninguna fila
                // (ausencia de filas = "juega todos los días", ver `dias` en
                // useEventGames.jsx). Esto es lo que hace que el selector de
                // días de un juego agregado durante la edición (o de uno ya
                // existente) efectivamente quede guardado.
                if (eventoEditadoEsMultiDia && insertedGames?.length > 0) {
                    const daysToInsert = [];
                    insertedGames.forEach(eg => {
                        const selectedDays = gameDays?.[eg.game_id] ?? eventDatesGuardado;
                        const playsAllDays = eventDatesGuardado.every(d => selectedDays.includes(d));
                        if (!playsAllDays) {
                            selectedDays.forEach(date => {
                                daysToInsert.push({ event_game_id: eg.id, date });
                            });
                        }
                    });
                    if (daysToInsert.length > 0) {
                        const { error: daysError } = await supabase
                            .from('event_games_days')
                            .insert(daysToInsert);
                        if (daysError) throw daysError;
                    }
                }
            }

            setEventsData(prev => prev.map(e => e.id === editingEvent.id ? { ...e, ...payload } : e));

            setLocalEventGames(prev => ({
                ...prev,
                [editingEvent.id]: games
                    .filter(g => selectedGames.includes(g.id))
                    .map(g => {
                        const rawCupo = gameCupos?.[g.id];
                        const selectedDays = gameDays?.[g.id] ?? eventDatesGuardado;
                        const playsAllDays = eventoEditadoEsMultiDia && eventDatesGuardado.every(d => selectedDays.includes(d));
                        return {
                            id: g.id,
                            game_name: g.game_name,
                            team_option: g.team_option,
                            registration_mode: g.team_option ? (gameModes[g.id] ?? 'both') : 'individual',
                            cupo_maximo: rawCupo === '' || rawCupo == null ? null : Number(rawCupo),
                            dias: eventoEditadoEsMultiDia && !playsAllDays ? selectedDays : [],
                        };
                    }),
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

    // Ya no hace ningún fetch propio: qué juegos tienen inscripciones se
    // deriva de `localEventGames` (ver `gamesConInscripcionesEditar` más
    // arriba), que useEventGames ya carga para toda la lista apenas monta
    // el componente — abrir el modal no tiene que esperar ni volver a pedir
    // nada.
    const abrirEdicion = (event) => {
        setEditingEvent(event);
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
                    initialGameCupos={Object.fromEntries(
                        (localEventGames[editingEvent.id] || []).map(g => [g.id, g.cupo_maximo ?? ''])
                    )}
                    initialGameDays={initialGameDaysEditar}
                    ocupadosPorJuego={Object.fromEntries(
                        (localEventGames[editingEvent.id] || []).map(g => [g.id, g.ocupados ?? 0])
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

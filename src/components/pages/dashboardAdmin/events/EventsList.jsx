import { useEffect, useState } from 'react';
import { useEvents } from '../../../../hooks/useEvents';
import { useEventGames } from '../../../../hooks/useEventGames';
import { useGames } from '../../../../hooks/useGames';
import supabase from '../../../../utils/supabase';
import { AddTournamentForm } from './AddTournamentForm';
import { localidadesBuenosAires } from '../../../../data/localidades';

const BASE_URL = 'https://lcesports.com.ar';

const isoToDatetimeLocal = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EditEventModal = ({
    event,
    initialGames,
    games,
    loadingGames,
    errorGames,
    isSaving,
    onSave,
    onCancel,
}) => {
    const [form, setForm] = useState({
        fecha_inicio: event.fecha_inicio,
        fecha_fin: event.fecha_fin,
        localidad: event.localidad,
        ubicacion_url: event.ubicacion_url || '',
        inscripciones_abiertas: event.inscripciones_abiertas ?? true,
        tipo: event.tipo || 'torneo',
        visible_en_home: event.visible_en_home ?? true,
        fecha_cierre_inscripcion: isoToDatetimeLocal(event.fecha_cierre_inscripcion),
    });
    const [selectedGames, setSelectedGames] = useState(initialGames);

    const esPresentacion = form.tipo === 'presentacion';

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        // 'tipo' es inmutable una vez creado el evento: no tiene campo editable
        // (ver el <select disabled> más abajo), así que nunca llega acá.
        setForm(prev => ({ ...prev, [name]: newValue }));
    };

    const toggleGame = (gameId) => {
        setSelectedGames(prev =>
            prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
        );
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

                    {/* Juegos */}
                    {!esPresentacion ? (
                        <div className="event-edit-field event-edit-field--full">
                            <label className="event-edit-label">Juegos</label>
                            {loadingGames && <p className="event-edit-hint">Cargando juegos...</p>}
                            {errorGames && <p className="event-edit-error">Error al cargar juegos</p>}
                            {!loadingGames && !errorGames && (
                                <div className="event-edit-games">
                                    {games?.map(game => (
                                        <label key={game.id} className="event-edit-game-label">
                                            <input
                                                type="checkbox"
                                                checked={selectedGames.includes(game.id)}
                                                onChange={() => toggleGame(game.id)}
                                            />
                                            {game.game_name}
                                        </label>
                                    ))}
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
                        onClick={() => onSave(form, selectedGames)}
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
    useEffect(() => {
        const fetchInscripcionesFlags = async () => {
            if (eventIds.length === 0) return;
            const { data, error } = await supabase
                .from('inscriptions')
                .select('id_evento')
                .in('id_evento', eventIds);

            if (error) {
                console.error('Error al verificar inscripciones por evento:', error);
                return;
            }

            const conInscripciones = new Set((data || []).map(r => r.id_evento));
            setTieneInscripciones(
                Object.fromEntries(eventIds.map(id => [id, conInscripciones.has(id)]))
            );
        };
        fetchInscripcionesFlags();
    }, [JSON.stringify(eventIds)]);

    const saveChanges = async (form, selectedGames) => {
        if (isSaving || !editingEvent) return;
        setIsSaving(true);

        try {
            // 'tipo' se excluye a propósito del payload de update: es inmutable
            // después de creado el evento (el <select> de arriba ya está disabled,
            // esto es una segunda barrera por si algo llega a tocar form.tipo).
            const { tipo: _tipoInmutable, ...formEditable } = form;
            const payload = {
                ...formEditable,
                fecha_cierre_inscripcion: form.fecha_cierre_inscripcion
                    ? new Date(form.fecha_cierre_inscripcion).toISOString()
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
                    .insert(selectedGames.map(gameId => ({ event_id: editingEvent.id, game_id: gameId })));
                if (insertError) throw insertError;
            }

            setEventsData(prev => prev.map(e => e.id === editingEvent.id ? { ...e, ...payload } : e));

            setLocalEventGames(prev => ({
                ...prev,
                [editingEvent.id]: games
                    .filter(g => selectedGames.includes(g.id))
                    .map(g => ({ id: g.id, game_name: g.game_name })),
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
                                <td>{event.localidad}</td>
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
                                            onClick={() => setEditingEvent(event)}
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
                    games={games}
                    loadingGames={loadingGames}
                    errorGames={errorGames}
                    isSaving={isSaving}
                    onSave={saveChanges}
                    onCancel={() => setEditingEvent(null)}
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

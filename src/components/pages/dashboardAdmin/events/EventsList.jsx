import { useEffect, useState } from 'react';
import { useEvents } from '../../../../hooks/useEvents';
import { useEventGames } from '../../../../hooks/useEventGames';
import { useGames } from '../../../../hooks/useGames';
import supabase from '../../../../utils/supabase';
import { AddTournamentForm } from './AddTournamentForm';
import { localidadesBuenosAires } from '../../../../data/localidades';

export const EventsList = () => {
    const [showModal, setShowModal] = useState(false);
    const { eventsData, eventsError, eventsLoading, setEventsData } = useEvents();
    const [editingId, setEditingId] = useState(null);
    const [editedEvent, setEditedEvent] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [selectedGames, setSelectedGames] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [localEventGames, setLocalEventGames] = useState({});

    const eventIds = eventsData?.map(event => event.id) || [];
    const { eventGames, loading: loadingEventGames, error: errorEventGames } = useEventGames(eventIds);
    const { games, loading: loadingGames, error: errorGames } = useGames();

    // Inicializar localEventGames cuando eventGames cambia
    useEffect(() => {
        if (eventGames && Object.keys(eventGames).length > 0) {
            setLocalEventGames(eventGames);
        }
    }, [eventGames]);

    const localidadesOptions = localidadesBuenosAires.map((localidad) => ({
        value: localidad,
        label: localidad
    }));

    const startEditing = (event) => {
        setEditingId(event.id);
        setEditedEvent({
            fecha_inicio: event.fecha_inicio,
            fecha_fin: event.fecha_fin,
            localidad: event.localidad
        });
        const eventGameIds = localEventGames[event.id]?.map(game => game.id) || [];
        setSelectedGames(eventGameIds);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditedEvent(null);
        setSelectedGames([]);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditedEvent(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCheckboxChange = (gameId) => {
        setSelectedGames(prev => {
            if (prev.includes(gameId)) {
                return prev.filter(id => id !== gameId);
            } else {
                return [...prev, gameId];
            }
        });
    };

    const saveChanges = async (id) => {
        if (isSaving) return;
        setIsSaving(true);

        try {
            // Update event details
            const { error: eventError } = await supabase
                .from('events')
                .update(editedEvent)
                .eq('id', id);

            if (eventError) throw eventError;

            // Delete existing game associations
            const { error: deleteError } = await supabase
                .from('event_games')
                .delete()
                .eq('event_id', id);

            if (deleteError) throw deleteError;

            // Insert new game associations
            if (selectedGames.length > 0) {
                const { error: insertError } = await supabase
                    .from('event_games')
                    .insert(
                        selectedGames.map(gameId => ({
                            event_id: id,
                            game_id: gameId
                        }))
                    );

                if (insertError) throw insertError;
            }

            // Update local states
            setEventsData(prevEvents =>
                prevEvents.map(event =>
                    event.id === id ? { ...event, ...editedEvent } : event
                )
            );

            // Update local event games state
            const selectedGamesDetails = games
                .filter(game => selectedGames.includes(game.id))
                .map(game => ({
                    id: game.id,
                    game_name: game.game_name
                }));

            setLocalEventGames(prev => ({
                ...prev,
                [id]: selectedGamesDetails
            }));

            setEditingId(null);
            setEditedEvent(null);
            setSelectedGames([]);
            setMessage({ type: 'success', text: 'Evento actualizado correctamente' });
            setTimeout(() => setMessage({ type: '', text: '' }), 2000);
        } catch (error) {
            console.error('Error al actualizar:', error);
            setMessage({ type: 'error', text: 'Error al guardar los cambios' });
        } finally {
            setIsSaving(false);
        }
    };

    if (eventsLoading) return <div className="inscriptions-container">Cargando eventos...</div>;
    if (eventsError) return <div className="error-message-admin">Error al cargar eventos: {eventsError}</div>;

    return (
        <div className="inscriptions-container">
            <h2 className='titulos-admin'>Lista de Eventos</h2>
            <button className="export-button" onClick={() => setShowModal(true)}>
                Cargar Evento
            </button>

            {message.text && (
                <div className={message.type === 'success' ? 'success-message-admin' : 'error-message-admin'}>
                    {message.text}
                </div>
            )}

            <table className="inscriptions-table">
                <thead>
                    <tr>
                        <th>Fecha Inicio</th>
                        <th>Fecha Fin</th>
                        <th>Localidad</th>
                        <th>Juegos</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {eventsData?.map(event => (
                        <tr key={event.id}>
                            {editingId === event.id ? (
                                <>
                                    <td>
                                        <input
                                            type="date"
                                            name="fecha_inicio"
                                            value={editedEvent.fecha_inicio}
                                            onChange={handleInputChange}
                                            className="filter-date"
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="date"
                                            name="fecha_fin"
                                            value={editedEvent.fecha_fin}
                                            onChange={handleInputChange}
                                            className="filter-date"
                                        />
                                    </td>
                                    <td>
                                        <select
                                            name="localidad"
                                            value={editedEvent.localidad}
                                            onChange={handleInputChange}
                                            className="filter-select"
                                        >
                                            <option value="">Selecciona una localidad</option>
                                            {localidadesOptions.map((localidad, index) => (
                                                <option key={index} value={localidad.value}>
                                                    {localidad.label}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        {loadingGames && <p>Cargando juegos...</p>}
                                        {errorGames && <p className="error-message">Error al cargar juegos: {errorGames}</p>}

                                        {!loadingGames && !errorGames && games?.length > 0 ? (
                                            <div className="games-checkbox-container">
                                                {games.map((game) => (
                                                    <label key={game.id} className="game-checkbox">
                                                        <input
                                                            type="checkbox"
                                                            value={game.id}
                                                            checked={selectedGames.includes(game.id)}
                                                            onChange={() => handleCheckboxChange(game.id)}
                                                        />
                                                        {game.game_name}
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            !loadingGames && <p>No hay juegos disponibles.</p>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            className="export-button"
                                            onClick={() => saveChanges(event.id)}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? 'Guardando...' : 'Aceptar'}
                                        </button>
                                        <button
                                            className="cancel-button"
                                            onClick={cancelEditing}
                                            disabled={isSaving}
                                        >
                                            Cancelar
                                        </button>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td>{new Date(event.fecha_inicio + 'T00:00:00').toLocaleDateString()}</td>
                                    <td>{new Date(event.fecha_fin + 'T00:00:00').toLocaleDateString()}</td>
                                    <td>{event.localidad}</td>
                                    <td>
                                        {loadingEventGames && <label>Cargando juegos...</label>}
                                        {errorEventGames && <label>Error al cargar juegos: {errorEventGames}</label>}

                                        {!loadingEventGames && !errorEventGames && localEventGames[event.id]?.length > 0 ? (
                                            <div className="games-tags-container">
                                                {localEventGames[event.id]?.map(game => (
                                                    <span key={game.game_name} className="game-tag">
                                                        {game.game_name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            !loadingEventGames && <p>No hay juegos disponibles.</p>
                                        )}
                                    </td>
                                    <td>
                                        <button className="export-button" onClick={() => startEditing(event)}>
                                            Modificar
                                        </button>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>

            {showModal && (
                <div className="modal-torneo">
                    <div className="modal-content">
                        <button className="cancel-button" onClick={() => setShowModal(false)}>Cerrar</button>
                        <AddTournamentForm />
                    </div>
                </div>
            )}
        </div>
    );
};
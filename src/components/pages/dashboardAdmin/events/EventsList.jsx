import { useState } from 'react'
import { useEvents } from '../../../../hooks/useEvents';
import supabase from '../../../../utils/supabase';
import { AddTournamentForm } from './AddTournamentForm';
import { localidadesBuenosAires } from '../../../../data/localidades';

export const EventsList = () => {
    const [showModal, setShowModal] = useState(false);
    const { eventsData, eventsError, eventsLoading, setEventsData } = useEvents();
    const [editingId, setEditingId] = useState(null);
    const [editedEvent, setEditedEvent] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });

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
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditedEvent(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditedEvent(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const saveChanges = async (id) => {
        try {
            const { error } = await supabase
                .from('events')
                .update(editedEvent)
                .eq('id', id);

            if (error) throw error;

            setEventsData(prevEvents =>
                prevEvents.map(event =>
                    event.id === id ? { ...event, ...editedEvent } : event
                )
            );

            setEditingId(null);
            setEditedEvent(null);
            setMessage({ type: 'success', text: 'Evento actualizado correctamente' });
            setTimeout(() => setMessage({ type: '', text: '' }), 2000);
        } catch (error) {
            console.error('Error al actualizar:', error);
            setMessage({ type: 'error', text: 'Error al guardar los cambios' });
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
                                        <button className="export-button" onClick={() => saveChanges(event.id)}>
                                            Aceptar
                                        </button>
                                        <button className="cancel-button" onClick={cancelEditing}>
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
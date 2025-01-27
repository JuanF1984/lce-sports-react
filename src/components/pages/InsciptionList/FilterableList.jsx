import { useState, useEffect } from 'react';
import supabase from '../../../utils/supabase';

export const FilterableList = ({ onFilterChange }) => {
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState("");

    useEffect(() => {
        const fetchEvents = async () => {
            const { data: eventData, error } = await supabase
                .from("events")
                .select("id, fecha_inicio, localidad")
                .order('fecha_inicio', { ascending: false });

            if (!error) {
                setEvents(eventData);
            } else {
                console.error("Error fetching events:", error);
            }
        };

        fetchEvents();
    }, []);

    const handleFilterChange = (e) => {
        const eventId = e.target.value;
        setSelectedEvent(eventId);
        if (onFilterChange) {
            onFilterChange(eventId); // Comunicar el cambio al componente padre
        }
    };

    return (
        <div>
            <label htmlFor="event-filter">Selecciona un evento:</label>
            <select id="event-filter" value={selectedEvent} onChange={handleFilterChange}>
                <option value="">-- Seleccionar --</option>
                <option value="">Todos</option>
                {events.map((event) => (
                    <option key={event.id} value={event.id}>
                        {event.fecha_inicio} - {event.localidad}
                    </option>
                ))}
            </select>
        </div>
    );
};

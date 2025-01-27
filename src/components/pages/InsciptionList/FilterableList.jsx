import { useState } from "react";

export const FilterableList = ({ inscriptions, events, onFilter }) => {
    const [selectedEvent, setSelectedEvent] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const handleEventChange = (e) => {
        const eventId = e.target.value;
        setSelectedEvent(eventId);

        let filtered = [...inscriptions];

        if (eventId !== "") {
            filtered = filtered.filter((inscription) =>
                inscription.id_evento === eventId
            );
        }

        // Aplicar filtros de fecha si existen
        if (startDate) {
            filtered = filtered.filter((inscription) => {
                const createdAt = new Date(inscription.created_at).toISOString().split('T')[0];
                return createdAt >= startDate;
            });
        }

        if (endDate) {
            filtered = filtered.filter((inscription) => {
                const createdAt = new Date(inscription.created_at).toISOString().split('T')[0];
                return createdAt <= endDate;
            });
        }

        onFilter(filtered);
    };

    const handleDateChange = (e, isStartDate) => {
        const newDate = e.target.value;

        if (isStartDate) {
            setStartDate(newDate);
        } else {
            setEndDate(newDate);
        }

        let filtered = [...inscriptions];

        if (selectedEvent !== "") {
            filtered = filtered.filter((inscription) =>
                inscription.id_evento === selectedEvent
            );
        }

        // Aplicar filtro de fecha inicio
        if (isStartDate ? newDate : startDate) {
            const dateToUse = isStartDate ? newDate : startDate;
            filtered = filtered.filter((inscription) => {
                const createdAt = new Date(inscription.created_at).toISOString().split('T')[0];
                return createdAt >= dateToUse;
            });
        }

        // Aplicar filtro de fecha fin
        if (!isStartDate ? newDate : endDate) {
            const dateToUse = !isStartDate ? newDate : endDate;
            filtered = filtered.filter((inscription) => {
                const createdAt = new Date(inscription.created_at).toISOString().split('T')[0];
                return createdAt <= dateToUse;
            });
        }

        onFilter(filtered);
    };

    return (
        <div className="filter-container">
            <label htmlFor="event-filter">Filtrar por evento:</label>
            <select id="event-filter" value={selectedEvent} onChange={handleEventChange}>
                <option value="">Todos</option>
                {events.map((event) => (
                    <option key={event.id} value={event.id}>
                        {event.fecha_inicio} - {event.localidad}
                    </option>
                ))}
            </select>

            <label htmlFor="start-date">Desde:</label>
            <input
                type="date"
                id="start-date"
                value={startDate}
                onChange={(e) => handleDateChange(e, true)}
            />

            <label htmlFor="end-date">Hasta:</label>
            <input
                type="date"
                id="end-date"
                value={endDate}
                onChange={(e) => handleDateChange(e, false)}
            />
        </div>
    );
};
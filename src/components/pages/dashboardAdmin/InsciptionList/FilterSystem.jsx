import { useState, useEffect, useCallback } from "react";

import { formatearFecha } from "../../../../utils/dateUtils";

export const FilterSystem = ({ inscriptions, events, games, onFilter, onFiltersChange, initialFilters }) => {
    const [filters, setFilters] = useState(initialFilters || {
        eventId: "",
        startDate: "",
        endDate: "",
        gameId: "",
    });

    // useEffect para detectar cuando cambian los initialFilters
    useEffect(() => {
        if (initialFilters) {
            console.log("Actualizando filtros con initialFilters:", initialFilters);
            setFilters(initialFilters);
            // No aplicamos los filtros aquí, porque el cambio de evento ya será manejado por el componente padre
        }
    }, [initialFilters]);

    // Función centralizada de filtrado
    const applyFilters = useCallback((currentFilters = filters) => {
        console.log("Aplicando filtros en FilterSystem:", currentFilters);
        console.log("Total de inscripciones a filtrar:", inscriptions.length);

        // Si no hay inscripciones, no hay nada que filtrar
        if (inscriptions.length === 0) {
            console.log("No hay inscripciones para filtrar");
            onFilter([]);
            return;
        }

        // Clonamos el array de inscripciones para no modificar el original
        let filtered = [...inscriptions];

        // Objeto que define las reglas de filtrado con logs de diagnóstico
        const filterRules = {
            // Ya no filtramos por eventId aquí, porque ya cargamos solo las del evento seleccionado
            startDate: (inscription) => {
                if (!currentFilters.startDate) return true;

                // Verificamos que tenemos una fecha válida
                if (!inscription.created_at) {
                    console.warn("Inscripción sin fecha de creación:", inscription);
                    return false;
                }

                const inscriptionDate = new Date(inscription.created_at).toISOString().split('T')[0];
                return inscriptionDate >= currentFilters.startDate;
            },
            endDate: (inscription) => {
                if (!currentFilters.endDate) return true;

                // Verificamos que tenemos una fecha válida
                if (!inscription.created_at) {
                    console.warn("Inscripción sin fecha de creación:", inscription);
                    return false;
                }

                const inscriptionDate = new Date(inscription.created_at).toISOString().split('T')[0];
                return inscriptionDate <= currentFilters.endDate;
            },
            gameId: (inscription) => {
                if (!currentFilters.gameId) return true;

                // Verificamos que tenemos juegos asociados
                const inscriptionGames = inscription.games_inscriptions || [];
                if (inscriptionGames.length === 0) {
                    // Si estamos filtrando por juego y esta inscripción no tiene juegos, no la mostramos
                    return false;
                }

                return inscriptionGames.some(gi => gi.game?.id === currentFilters.gameId);
            }
        };

        // Aplicar cada filtro por separado para poder diagnosticar
        Object.keys(filterRules).forEach(filterKey => {
            const countBefore = filtered.length;
            filtered = filtered.filter(filterRules[filterKey]);
            const countAfter = filtered.length;

            // Solo loguear si el filtro está activo y elimina registros
            if (currentFilters[filterKey] && countBefore !== countAfter) {
                console.log(`Filtro ${filterKey} eliminó ${countBefore - countAfter} inscripciones. Quedan ${countAfter}`);
            }
        });

        console.log("Total de inscripciones después de filtrar:", filtered.length);
        onFilter(filtered);
    }, [inscriptions, onFilter]);

    // Cuando cambia el evento, notificamos al componente padre
    const handleEventChange = (eventId) => {
        console.log(`Evento seleccionado cambiado a: ${eventId}`);
        const newFilters = {
            ...filters,
            eventId
        };

        setFilters(newFilters);
        onFiltersChange(newFilters);
    };

    // Manejador para otros filtros (fecha, juego)
    const handleOtherFilterChange = (filterKey, value) => {
        const newFilters = {
            ...filters,
            [filterKey]: value
        };

        setFilters(newFilters);
        applyFilters(newFilters);
        onFiltersChange(newFilters);
    };

    return (
        <div className="filters-container">
            {/* Filtro de Eventos */}
            <div className="filter-group">
                <label htmlFor="event-filter" className="filter-label">Filtrar por evento:</label>
                <select
                    id="event-filter"
                    value={filters.eventId}
                    onChange={(e) => handleEventChange(e.target.value)}
                    className="filter-select"
                >
                    <option value="">Selecciona un evento</option>
                    {events.map(event => (
                        <option key={event.id} value={event.id}>
                            {event.localidad} - {formatearFecha (event.fecha_inicio)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Solo mostramos el resto de filtros si hay un evento seleccionado */}
            {filters.eventId && (
                <>
                    {/* Filtro de Juegos */}
                    <div className="filter-group">
                        <label htmlFor="game-filter" className="filter-label">Filtrar por juego:</label>
                        <select
                            id="game-filter"
                            value={filters.gameId}
                            onChange={(e) => handleOtherFilterChange('gameId', e.target.value)}
                            className="filter-select"
                        >
                            <option value="">Todos los juegos</option>
                            {games.map(game => (
                                <option key={game.id} value={game.id}>
                                    {game.game_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filtros de Fecha */}
                    <div className="filter-group date-filters">
                        <label className="filter-label">Filtrar por fecha de inscripción:</label>
                        <div className="date-inputs">
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => handleOtherFilterChange('startDate', e.target.value)}
                                className="filter-date"
                            />
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => handleOtherFilterChange('endDate', e.target.value)}
                                className="filter-date"
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
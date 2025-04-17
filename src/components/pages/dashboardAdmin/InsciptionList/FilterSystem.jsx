import { useState, useEffect, useCallback } from "react";

export const FilterSystem = ({ inscriptions, events, games, onFilter, onFiltersChange, initialFilters }) => {
    const [filters, setFilters] = useState(initialFilters || {
        eventId: "",
        startDate: "",
        endDate: "",
        gameId: "", // Nuevo filtro
    });

    // useEffect para detectar cuando cambian los initialFilters
    useEffect(() => {
        if (initialFilters) {
            setFilters(initialFilters);
            applyFilters(initialFilters);
        }
    }, [initialFilters]);

    // Función centralizada de filtrado
    const applyFilters = useCallback((currentFilters = filters) => {
        let filtered = [...inscriptions];

        // Objeto que define las reglas de filtrado
        const filterRules = {
            eventId: (inscription) =>
                !currentFilters.eventId || inscription.id_evento === currentFilters.eventId,

            startDate: (inscription) =>
                !currentFilters.startDate ||
                new Date(inscription.created_at).toISOString().split('T')[0] >= currentFilters.startDate,

            endDate: (inscription) =>
                !currentFilters.endDate ||
                new Date(inscription.created_at).toISOString().split('T')[0] <= currentFilters.endDate,

            gameId: (inscription) => {
                if (!currentFilters.gameId) return true;
                const inscriptionGames = inscription.games_inscriptions || [];
                return inscriptionGames.some(gi => gi.game?.id === currentFilters.gameId);

            }
        };

        // Aplicar todos los filtros
        Object.keys(filterRules).forEach(filterKey => {
            filtered = filtered.filter(filterRules[filterKey]);
        });

        onFilter(filtered);
        onFiltersChange(currentFilters); // Actualiza los filtros en el componente padre
    }, [inscriptions, onFilter, onFiltersChange]);

    // Manejador genérico para cambios en los filtros
    const handleFilterChange = (filterKey, value) => {
        const newFilters = {
            ...filters,
            [filterKey]: value
        };
        setFilters(newFilters);
        applyFilters(newFilters);
    };

    return (
        <div className="filters-container">
            {/* Filtro de Eventos */}
            <div className="filter-group">
                <label htmlFor="event-filter" className="filter-label">Filtrar por evento:</label>
                <select
                    id="event-filter"
                    value={filters.eventId}
                    onChange={(e) => handleFilterChange('eventId', e.target.value)}
                    className="filter-select"
                >
                    <option value="">Todos los eventos</option>
                    {events.map(event => (
                        <option key={event.id} value={event.id}>
                            {event.localidad} - {new Date(event.fecha_inicio).toLocaleDateString()}
                        </option>
                    ))}
                </select>
            </div>

            {/* Filtro de Juegos */}
            <div className="filter-group">
                <label htmlFor="game-filter" className="filter-label">Filtrar por juego:</label>
                <select
                    id="game-filter"
                    value={filters.gameId}
                    onChange={(e) => handleFilterChange('gameId', e.target.value)}
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
                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                        className="filter-date"
                    />
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                        className="filter-date"
                    />
                </div>
            </div>
        </div>
    );
};
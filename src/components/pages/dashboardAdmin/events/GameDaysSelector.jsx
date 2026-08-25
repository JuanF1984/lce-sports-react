import { formatDiaLabel } from '../../../../utils/eventDays';

// Selector de "¿qué días se juega?" para un juego puntual dentro de un evento
// de varios días. Compartido entre la carga inicial (AddTournamentForm) y la
// edición (EventsList/EditEventModal) para que ambos flujos ofrezcan el mismo
// control y persistan la misma estructura en `event_games_days`.
export const GameDaysSelector = ({ eventDates, selectedDays, onToggle }) => (
    <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.1rem' }}>
            ¿Qué días se juega?
        </span>
        {eventDates.map(date => (
            <label key={date} className="checkbox-label" style={{ fontSize: '0.83rem' }}>
                <input
                    type="checkbox"
                    checked={selectedDays.includes(date)}
                    onChange={() => onToggle(date)}
                />
                {formatDiaLabel(date)}
            </label>
        ))}
    </div>
);

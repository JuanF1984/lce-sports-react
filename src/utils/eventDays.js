// Helpers de días de evento, compartidos entre la carga inicial
// (AddTournamentForm) y la edición (EventsList/EditEventModal) para que
// ambos flujos calculen y persistan exactamente lo mismo en `event_games_days`.

export const DIAS_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Devuelve todas las fechas (YYYY-MM-DD) entre startStr y endStr, inclusive.
export const getDatesInRange = (startStr, endStr) => {
    const dates = [];
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    const cur = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    while (cur <= end) {
        dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
};

export const formatDiaLabel = (fechaStr) => {
    const [y, m, d] = fechaStr.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return `${DIAS_NOMBRES[fecha.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

// Modalidad de inscripción efectiva de un juego dentro de un evento puntual
// (event_games.registration_mode), con el fallback histórico basado en
// games.team_option cuando registration_mode es NULL (eventos/juegos creados
// antes de que existiera esta columna).
//
// Importante: históricamente team_option = true NUNCA significó "solo equipo".
// El flujo viejo mostraba esos juegos tanto en la lista individual como en la
// de equipo — es decir, se comportaba como 'both', no como 'team'. team_option
// = false se comportaba como 'individual'. El modo 'team' (solo equipo) no
// existía antes de agregar registration_mode.
export const getEffectiveRegistrationMode = (game) => {
    if (game?.registration_mode === 'individual' || game?.registration_mode === 'team' || game?.registration_mode === 'both') {
        return game.registration_mode;
    }
    return game?.team_option ? 'both' : 'individual';
};

export const permiteIndividual = (game) => getEffectiveRegistrationMode(game) !== 'team';

export const permiteEquipo = (game) => getEffectiveRegistrationMode(game) !== 'individual';

// Reglas de negocio configurables por evento (events.edad_minima, events.edad_maxima,
// events.modo_seleccion_juegos, events.max_juegos_por_participante).
// Ver docs/inscripciones.md, sección "Reglas configurables por evento", para el
// detalle completo de semántica y de dónde se aplica cada una.
//
// Importante: todo lo de acá es SOLO validación de experiencia de usuario. La
// validación definitiva vive en Supabase (triggers sobre `inscriptions` y
// `games_inscriptions`, ver supabase/migrations/20260804_event_participation_rules.sql).
// Si el frontend dejara pasar algo (bug, evento cargado a medias, request
// directa), el trigger lo rechaza igual — por eso los códigos de acá coinciden
// 1 a 1 con los marcadores que usa el trigger.

// edad: string tal cual la tipeó la persona (mismo campo de texto de siempre,
// sin fecha de nacimiento). evento: fila de `events` (o null/undefined).
export const validateParticipantAge = (edad, evento) => {
    const edadMinima = evento?.edad_minima ?? null;
    const edadMaxima = evento?.edad_maxima ?? null;

    if (edadMinima == null && edadMaxima == null) {
        return { valid: true };
    }

    const trimmed = String(edad ?? '').trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
        return { valid: false, code: 'INVALID_PARTICIPANT_AGE' };
    }

    const edadNum = Number(trimmed);

    if (edadMinima != null && edadNum < edadMinima) {
        return { valid: false, code: 'EVENT_MINIMUM_AGE_NOT_MET' };
    }
    if (edadMaxima != null && edadNum > edadMaxima) {
        return { valid: false, code: 'EVENT_MAXIMUM_AGE_EXCEEDED' };
    }
    return { valid: true };
};

export const participantAgeErrorMessage = (code, evento) => {
    switch (code) {
        case 'EVENT_MAXIMUM_AGE_EXCEEDED':
            return `Este torneo admite participantes de hasta ${evento?.edad_maxima} años inclusive.`;
        case 'EVENT_MINIMUM_AGE_NOT_MET':
            return `Este torneo admite participantes a partir de ${evento?.edad_minima} años.`;
        case 'INVALID_PARTICIPANT_AGE':
        default:
            return 'Ingresá una edad válida para continuar.';
    }
};

// Modo de selección de juegos. En 'clasificado' (default histórico) esta
// función siempre devuelve null: no se aplica ningún límite nuevo, sigue el
// comportamiento hardcodeado de SeleccionJuego.jsx (1 principal + 1 secundario,
// o hasta 3 secundarios sin principal) exactamente igual que antes. Solo bajo
// 'libre' se usa max_juegos_por_participante (null = sin límite).
export const getMaxJuegosLibre = (evento) => {
    if (evento?.modo_seleccion_juegos !== 'libre') return null;
    return evento?.max_juegos_por_participante ?? null;
};

export const esModoLibre = (evento) => evento?.modo_seleccion_juegos === 'libre';

// Marcadores que puede devolver el trigger de Supabase (ver la migración) y su
// mensaje para el usuario final. Se usan en Confirmacion.jsx / ConfirmacionEquipo.jsx
// para no exponer el error crudo de Postgres ante un rechazo del lado servidor
// (bypass del frontend, evento con reglas cargadas después de abrir el wizard, etc.).
export const SUPABASE_RULE_ERROR_MESSAGES = {
    INVALID_PARTICIPANT_AGE: 'La edad ingresada no es válida para este evento.',
    EVENT_MINIMUM_AGE_NOT_MET: 'No se cumple la edad mínima requerida para este evento.',
    EVENT_MAXIMUM_AGE_EXCEEDED: 'Se superó la edad máxima permitida para este evento.',
    EVENT_GAME_LIMIT_EXCEEDED: 'Se superó la cantidad máxima de juegos permitida por participante en este evento.',
    // Cupo máximo por evento+juego (event_games.cupo_maximo), ver
    // supabase/migrations/20260824_event_game_cupos.sql. El mismo marcador lo
    // puede disparar tanto una inscripción individual (Confirmacion.jsx) como
    // el RPC register_team_inscription (ConfirmacionEquipo.jsx) — para el
    // caso de equipo se usa un mensaje distinto, más específico, ver
    // TEAM_CUPO_EXCEEDED_MESSAGE y el segundo parámetro `context` de
    // mapSupabaseRuleError más abajo.
    EVENT_GAME_CUPO_EXCEEDED: 'Ya no quedan cupos disponibles para este juego.',
    // Agregados en la auditoría de seguridad de register_team_inscription
    // (ver supabase/migrations/20260824_event_game_cupos.sql): en el flujo
    // normal no deberían poder dispararse — el frontend nunca ofrece un
    // juego que no esté asociado al evento, ni permite armar un equipo para
    // un juego individual-only — pero si el evento se editó (se sacó el
    // juego, o se le cambió la modalidad) justo entre que alguien abrió el
    // wizard y confirmó, o si alguien llama al RPC directo, hace falta un
    // mensaje entendible en vez del error crudo de SQL.
    EVENT_GAME_NOT_CONFIGURED: 'Este juego ya no está disponible para este evento. Volvé a intentar desde el principio.',
    TEAM_NOT_ALLOWED_FOR_GAME: 'Este juego no admite inscripción de equipos en este evento.',
};

// Mensaje específico para EVENT_GAME_CUPO_EXCEEDED cuando lo dispara una
// inscripción de EQUIPO: el problema no es "no hay cupo en absoluto" (podría
// quedar 1 cupo libre y el equipo tener 5 integrantes) sino "no entra el
// equipo completo" — se lo distingue para no confundir al capitán.
const TEAM_CUPO_EXCEEDED_MESSAGE = 'No quedan suficientes cupos para inscribir a todo el equipo.';

// Restricción UNIQUE (id_inscription, id_game) — ver Sección 4 de la
// migración. No es un marcador custom como los de arriba: es el
// unique_violation estándar de Postgres (errcode 23505). En el flujo normal
// no debería poder dispararse (SeleccionJuego.jsx arma la selección con
// `.some()`/`.findIndex()` sobre el id del juego, por lo que estructuralmente
// no permite elegir el mismo juego dos veces), pero si de todas formas
// aparece (reintento de red, request directa que bypassea el frontend, etc.)
// no se debe exponer el mensaje crudo de SQL ("duplicate key value violates
// unique constraint ...").
const DUPLICATE_GAME_INSCRIPTION_CONSTRAINT = 'games_inscriptions_inscription_game_key';
const DUPLICATE_GAME_INSCRIPTION_MESSAGE = 'Ese juego ya estaba registrado para esta inscripción.';

// Devuelve el mensaje específico si el error de Supabase coincide con alguno
// de los marcadores conocidos, o null si no se reconoce (para que quien llama
// pueda aplicar su propio mensaje genérico de fallback). `context: 'team'`
// selecciona el mensaje específico de equipo para EVENT_GAME_CUPO_EXCEEDED
// (ver el comentario junto a TEAM_CUPO_EXCEEDED_MESSAGE); se ignora para
// cualquier otro marcador.
export const mapSupabaseRuleError = (error, context) => {
    if (!error) return null;
    const haystack = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
    for (const code of Object.keys(SUPABASE_RULE_ERROR_MESSAGES)) {
        if (haystack.includes(code)) {
            if (code === 'EVENT_GAME_CUPO_EXCEEDED' && context === 'team') {
                return TEAM_CUPO_EXCEEDED_MESSAGE;
            }
            return SUPABASE_RULE_ERROR_MESSAGES[code];
        }
    }
    if (error.code === '23505' && haystack.includes(DUPLICATE_GAME_INSCRIPTION_CONSTRAINT)) {
        return DUPLICATE_GAME_INSCRIPTION_MESSAGE;
    }
    return null;
};

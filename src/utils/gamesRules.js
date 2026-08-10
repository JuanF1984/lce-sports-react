// Reglas de la administración de juegos (games) — Etapa 1. Ver docs/games.md.
//
// El chequeo de nombre duplicado se hace primero contra el listado ya
// cargado en el cliente (GamesList.jsx, case-insensitive/trim) para dar
// feedback inmediato sin gastar un upload de imagen en vano. La protección
// definitiva vive igual en la base: índice UNIQUE case-insensitive sobre
// `game_name` (ver supabase/migrations/20260810_games_admin.sql). Si de
// todas formas llega a violarse (dos altas casi simultáneas desde dos
// sesiones admin distintas), Postgres devuelve el unique_violation estándar
// (errcode 23505) — mismo patrón que ya usa mapSupabaseRuleError en
// src/utils/eventRules.js para el UNIQUE de games_inscriptions.

const DUPLICATE_GAME_NAME_INDEX = 'games_game_name_unique_ci';
const DUPLICATE_GAME_NAME_MESSAGE = 'Ya existe un juego con ese nombre.';

export const mapGamesRuleError = (error) => {
    if (!error) return null;
    const haystack = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
    if (error.code === '23505' && haystack.includes(DUPLICATE_GAME_NAME_INDEX)) {
        return DUPLICATE_GAME_NAME_MESSAGE;
    }
    return null;
};

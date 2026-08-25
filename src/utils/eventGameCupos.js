import supabase from './supabase';

// Única fuente para consultar el RPC get_event_game_cupos (ocupados/
// disponibles por combinación event_id+game_id) — usado por useEventGames.jsx
// (listados públicos y precarga del admin) y por EventsList.jsx (revalidación
// fresca al guardar una edición). SECURITY DEFINER del lado de la base, no
// depende de RLS sobre inscriptions/games_inscriptions (ver
// supabase/migrations/20260824_event_game_cupos.sql, Sección 5).
//
// A diferencia de la vieja getGamesConInscripcionesDelEvento (removida:
// hacía un SELECT de inscriptions + un .in('id_inscription', ids) sobre
// games_inscriptions con potencialmente cientos/miles de UUIDs en la URL),
// este RPC recibe solo los event_id por POST y cuenta del lado del servidor
// — no hay ningún límite de tamaño de URL que pueda romperse con volumen.
//
// Lanza en vez de tragarse el error: cada consumidor decide su propia
// política fail-open (listados públicos, no bloquear la pantalla) o
// fail-closed (edición admin, no permitir cambios sin poder verificar).
export const fetchEventGameCupos = async (eventIds) => {
    const { data, error } = await supabase.rpc('get_event_game_cupos', {
        p_event_ids: eventIds,
    });
    if (error) throw error;
    return data || [];
};

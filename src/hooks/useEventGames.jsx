import { useEffect, useState } from "react";
import supabase from "../utils/supabase";
import { fetchEventGameCupos } from "../utils/eventGameCupos";

export const useEventGames = (eventIds) => {
    const [eventGames, setEventGames] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // true si el RPC get_event_game_cupos falló en la última corrida — los
    // consumidores que necesitan saber con certeza si un juego tiene
    // inscripciones (EventsList.jsx → EditEventModal) no pueden confiar en
    // `ocupados` mientras esto sea true (ver fetchEventGameCupos). Los
    // consumidores que solo muestran el dato de forma informativa
    // (SeleccionJuego.jsx) pueden seguir ignorándolo (fail-open a nivel UI,
    // sin cambios de comportamiento ahí).
    const [cuposError, setCuposError] = useState(false);

    useEffect(() => {
        if (!eventIds || eventIds.length === 0) return;

        const fetchEventGames = async () => {
            try {
                setLoading(true);
                setError(null);

                // Query principal: juegos por evento
                const { data, error: gamesError } = await supabase
                    .from("event_games")
                    .select(`
                        id,
                        event_id,
                        game_id,
                        registration_mode,
                        cupo_maximo,
                        games (
                            id,
                            game_name,
                            team_option,
                            principal,
                            image_path
                        )
                    `)
                    .in("event_id", eventIds);

                if (gamesError) {
                    throw new Error(`Error obteniendo juegos: ${gamesError.message}`);
                }

                if (!data) {
                    throw new Error("No se recibieron datos");
                }

                // Cupos ocupados/disponibles por (event_id, game_id) — un solo
                // RPC de solo lectura para todos los eventos pedidos, en vez de
                // un count() por juego desde el cliente. Ver
                // supabase/migrations/20260824_event_game_cupos.sql,
                // get_event_game_cupos(). Si falla (red, RPC no aplicado
                // todavía), no bloquea el resto de la pantalla: los juegos se
                // siguen mostrando, solo sin info de cupo (mismo criterio que
                // ya usa este hook para event_games_days más abajo) — la
                // protección real ante sobre-inscripción sigue viviendo en el
                // trigger de la base, no depende de que este dato llegue bien.
                const cuposMap = {};
                try {
                    const cuposData = await fetchEventGameCupos(eventIds);
                    cuposData.forEach(row => {
                        cuposMap[`${row.event_id}-${row.game_id}`] = row;
                    });
                    setCuposError(false);
                } catch (cuposErr) {
                    console.error("Error obteniendo cupos de juegos:", cuposErr);
                    setCuposError(true);
                }

                // Query opcional: días específicos por event_game
                // Si la tabla aún no existe o la relación no está lista, no rompe nada
                const eventGameIds = data.map(item => item.id).filter(Boolean);
                let daysMap = {};

                if (eventGameIds.length > 0) {
                    const { data: daysData } = await supabase
                        .from("event_games_days")
                        .select("event_game_id, date")
                        .in("event_game_id", eventGameIds);

                    if (daysData) {
                        daysMap = daysData.reduce((map, d) => {
                            if (!map[d.event_game_id]) map[d.event_game_id] = [];
                            map[d.event_game_id].push(d.date);
                            return map;
                        }, {});
                    }
                }

                // Formatear los juegos agrupados por event_id
                const gamesByEvent = data.reduce((acc, item) => {
                    if (item.games) {
                        if (!acc[item.event_id]) acc[item.event_id] = [];
                        const cupoInfo = cuposMap[`${item.event_id}-${item.game_id}`];
                        acc[item.event_id].push({
                            id: item.game_id,
                            event_game_id: item.id,
                            game_name: item.games.game_name,
                            team_option: item.games.team_option,
                            principal: item.games.principal,
                            image_path: item.games.image_path,
                            registration_mode: item.registration_mode,
                            dias: daysMap[item.id] ?? [],
                            // cupo_maximo: valor crudo configurado (null = sin límite).
                            // ocupados: personas ya inscriptas a este juego en este evento.
                            // cupos: DISPONIBLES — nombre que ya espera SeleccionJuego.jsx
                            // (GameCard: "Quedan {game.cupos}", isCompleto = cupos === 0).
                            // Si cupo_maximo es null, `cupos` queda null a propósito (sin
                            // límite artificial, ver docs/games.md). Si el RPC de cupos
                            // falló, se usa el cupo_maximo crudo como fallback optimista
                            // (fail-open a nivel de UI — la autoridad real es el trigger
                            // de la base, que igual rechaza cualquier exceso real).
                            cupo_maximo: item.cupo_maximo,
                            ocupados: cupoInfo?.ocupados ?? 0,
                            cupos: item.cupo_maximo == null
                                ? null
                                : (cupoInfo?.disponibles ?? item.cupo_maximo),
                        });
                    }
                    return acc;
                }, {});

                // Verificamos si el estado realmente cambió antes de actualizar
                setEventGames(prevState => {
                    const isEqual = JSON.stringify(prevState) === JSON.stringify(gamesByEvent);
                    return isEqual ? prevState : gamesByEvent;
                });

            } catch (err) {
                console.error("Error en fetchEventGames:", err);
                setError(err.message);
                setEventGames({});
            } finally {
                setLoading(false);
            }
        };

        fetchEventGames();

    }, [JSON.stringify(eventIds)]); // Evitamos cambios innecesarios en el array de dependencias

    return { eventGames, loading, error, cuposError };
};

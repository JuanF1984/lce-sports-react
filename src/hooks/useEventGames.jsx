import { useEffect, useState } from "react";
import supabase from "../utils/supabase";

export const useEventGames = (eventIds) => {
    const [eventGames, setEventGames] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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
                        games (
                            id,
                            game_name,
                            team_option,
                            principal
                        )
                    `)
                    .in("event_id", eventIds);

                if (gamesError) {
                    throw new Error(`Error obteniendo juegos: ${gamesError.message}`);
                }

                if (!data) {
                    throw new Error("No se recibieron datos");
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
                        acc[item.event_id].push({
                            id: item.game_id,
                            game_name: item.games.game_name,
                            team_option: item.games.team_option,
                            principal: item.games.principal,
                            dias: daysMap[item.id] ?? [],
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

    return { eventGames, loading, error };
};

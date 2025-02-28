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

                const { data, error: gamesError } = await supabase
                    .from("event_games")
                    .select(`
                        event_id,
                        game_id,
                        games (
                            id,
                            game_name,
                            team_option
                        )
                    `)
                    .in("event_id", eventIds);

                if (gamesError) {
                    throw new Error(`Error obteniendo juegos: ${gamesError.message}`);
                }

                if (!data) {
                    throw new Error("No se recibieron datos");
                }

                // Formatear los juegos agrupados por event_id
                const gamesByEvent = data.reduce((acc, item) => {
                    if (item.games) {
                        if (!acc[item.event_id]) acc[item.event_id] = [];
                        acc[item.event_id].push({
                            id: item.game_id,
                            game_name: item.games.game_name,
                            team_option: item.games.team_option,
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

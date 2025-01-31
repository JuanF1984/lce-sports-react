import { useEffect, useState } from "react";
import supabase from "../utils/supabase";

export const useEventGames = (eventId) => {
    const [eventGames, setEventGames] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!eventId) return;

        const fetchEventGames = async () => {
            try {
                setLoading(true);
                setError(null);

                // Verificación si existe evento
                const { data: eventExists, error: eventError } = await supabase
                    .from("events")
                    .select("id")
                    .eq("id", eventId)
                    .single();

                if (eventError) {
                    throw new Error(`Error verificando evento: ${eventError.message}`);
                }

                if (!eventExists) {
                    throw new Error(`No se encontró el evento con ID: ${eventId}`);
                }

                // Buscar los juegos del evento
                const { data, error: gamesError } = await supabase
                    .from("event_games")
                    .select(`
                        game_id,
                        games (
                            id,
                            game_name
                        )
                    `)
                    .eq("event_id", eventId);


                if (gamesError) {
                    throw new Error(`Error obteniendo juegos: ${gamesError.message}`);
                }

                if (!data) {
                    throw new Error('No se recibieron datos');
                }

                if (data.length === 0) {
                    setEventGames([]);
                    return;
                }

                const formattedGames = data.map((item) => {
                    if (!item.games) {
                        return null;
                    }
                    return {
                        id: item.game_id,
                        name: item.games.game_name,
                    };
                }).filter(Boolean);

                setEventGames(formattedGames);

            } catch (err) {
                console.error('Error en fetchEventGames:', err);
                setError(err.message);
                setEventGames([]);
            } finally {
                setLoading(false);
            }
        };

        fetchEventGames();

        // Cleanup function
        return () => {
            setEventGames([]);
            setError(null);
            setLoading(false);
        };
    }, [eventId]);

    return { eventGames, loading, error };
};
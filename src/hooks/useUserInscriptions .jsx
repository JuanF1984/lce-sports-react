import { useState, useEffect } from 'react'
import supabase from '../utils/supabase'

export const useUserInscriptions = (userId) => {
    const [data, setData] = useState({ inscriptions: [], events: [], games: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!userId) return;

        const fetchData = async () => {
            try {
                setLoading(true);

                // 1️⃣ Obtener inscripciones del usuario
                const { data: inscriptions, error: errorInscriptions } = await supabase
                    .from("inscriptions")
                    .select("id, id_evento, nombre, apellido")
                    .eq("user_id", userId);

                if (errorInscriptions) throw errorInscriptions;

                if (inscriptions.length === 0) {
                    setData({ inscriptions: [], events: [], games: [] });
                    setLoading(false);
                    return;
                }

                const eventIds = inscriptions.map((insc) => insc.id_evento);
                const inscriptionIds = inscriptions.map((insc) => insc.id);

                // 2️⃣ Obtener detalles de eventos
                const { data: events, error: errorEvents } = await supabase
                    .from("events")
                    .select("id, fecha_inicio, localidad")
                    .in("id", eventIds);

                if (errorEvents) throw errorEvents;

                const formattedEvents = events.map((event) => ({
                    id: event.id,
                    name: `${event.fecha_inicio} - ${event.localidad}`,
                }));

                // 3️⃣ Obtener juegos en los que está inscrito
                const { data: gameInscriptions, error: errorGameIns } = await supabase
                    .from("games_inscriptions")
                    .select("id_game")
                    .in("id_inscription", inscriptionIds);

                if (errorGameIns) throw errorGameIns;

                const gameIds = gameInscriptions.map((g) => g.id_game);

                // 4️⃣ Obtener nombres de los juegos
                const { data: games, error: errorGames } = await supabase
                    .from("games")
                    .select("id, game_name")
                    .in("id", gameIds);

                if (errorGames) throw errorGames;

                const formattedInscriptions = inscriptions.map((insc) => ({
                    id: insc.id,
                    nombreCompleto: `${insc.nombre} ${insc.apellido}`,
                    id_evento: insc.id_evento,
                }));

                setData({
                    inscriptions: formattedInscriptions,
                    events: formattedEvents,
                    games: games.map((game) => ({ id: game.id, name: game.game_name })),
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId]);

    return { data, loading, error };
}

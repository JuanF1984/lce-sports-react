import { useState, useEffect } from 'react'
import supabase from '../utils/supabase'

// Lectura de TODOS los juegos (activos e inactivos) para el panel admin
// (GamesList.jsx). A propósito NO reutiliza useGames.jsx ni le agrega un
// parámetro: ese hook filtra `active = true` y lo usan
// AddTournamentForm.jsx/EventsList.jsx para el catálogo de juegos ofrecidos
// al asociar un juego a un evento — si ese filtro dejara de aplicarse ahí,
// un juego dado de baja volvería a poder asociarse a eventos nuevos. Ver
// docs/games.md, "Riesgos / casos borde", punto 6.
export const useGamesAdmin = () => {
    const [games, setGames] = useState(null)
    const [gamesError, setGamesError] = useState(null)
    const [gamesLoading, setGamesLoading] = useState(true)

    useEffect(() => {
        const fetchGames = async () => {
            try {
                const { data, error } = await supabase
                    .from('games')
                    .select('id, game_name, team_option, principal, active, image_path')
                    .order('game_name', { ascending: true })
                if (error) throw error
                setGames(data)
            } catch (err) {
                setGamesError(err.message)
            } finally {
                setGamesLoading(false)
            }
        }
        fetchGames()
    }, [])

    return { games, gamesError, gamesLoading, setGames }
}

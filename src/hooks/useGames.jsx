import {useEffect, useState} from 'react'
import supabase from '../utils/supabase'

export const useGames = () => {
  const [games, setGames] = useState ([])
  const [loadingGames, setLoadingGames] = useState (true)
  const [errorGames, setErrorGames] = useState (false)

  useEffect(()=>{
    const fetchGames = async () =>{
        setLoadingGames (true)
        setErrorGames (false)

        const {data, error} = await supabase
            .from ("games")
            .select ("id, game_name, team_option")
            .eq("active", true)
        
        if (error){
            setErrorGames (error.message)
        } else {
            setGames(data)
        }
        setLoadingGames(false)
    }

    fetchGames()
  }, [])

  return {games, loadingGames, errorGames}
}

import {useState, useEffect} from 'react'
import supabase from '../utils/supabase'

export const useEvents = () => {
    const [eventsData, setEventsData] = useState (null)
    const [eventsError, setEventsError] = useState (null)
    const [eventsLoading, setEventsLoading] = useState (true)
    
    useEffect (()=>{
        const fetchEvents = async ()=> {
            try {
                const {data, error} = await supabase.from("events").select("id, fecha_inicio, fecha_fin, localidad, hora_inicio")
                if (error) throw error
                setEventsData (data)
            } catch (err) {
                setEventsError (err.mensagge)
            } finally {
                setEventsLoading (false)
            }
        }
        fetchEvents()
    }, [])
  
    return {eventsData, eventsError, eventsLoading, setEventsData}
}



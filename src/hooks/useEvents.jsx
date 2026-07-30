import {useState, useEffect} from 'react'
import supabase from '../utils/supabase'

export const useEvents = () => {
    const [eventsData, setEventsData] = useState (null)
    const [eventsError, setEventsError] = useState (null)
    const [eventsLoading, setEventsLoading] = useState (true)
    
    useEffect (()=>{
        const fetchEvents = async ()=> {
            try {
                const {data, error} = await supabase.from("events").select("id, nombre, fecha_inicio, fecha_fin, localidad, hora_inicio, inscripciones_abiertas, tipo, visible_en_home, fecha_cierre_inscripcion, slug")
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



import { useState } from 'react'
import { LineaNeon } from '../../common/LineaNeon'

import { EventsList } from './events/EventsList'
import InscriptionsList from './InsciptionList/InscriptionsList'

export const DashboardAdmin = () => {
    const [inscriptions, setInscriptions] = useState(false)
    const [events, setEvents] = useState(false)

    const handleInscriptions = () => {
        setInscriptions(true)
        setEvents(false)
    }

    const handleEvents = () => {
        setEvents(true)
        setInscriptions(false)
    }

    return (
        <>
            <aside>
                <button onClick={handleInscriptions} className='export-button'>Listar Inscripciones</button>
                <button onClick={handleEvents} className='export-button'>Listar Eventos</button>
            </aside>
            <LineaNeon />

            {inscriptions && (<InscriptionsList />)}
            {events && (<EventsList />)}
        </>
    )
}

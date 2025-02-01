import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/UseAuth'

import { LineaNeon } from '../../common/LineaNeon'

import { EventsList } from './events/EventsList'
import InscriptionsList from './InsciptionList/InscriptionsList'

export const DashboardAdmin = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
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

    useEffect(() => {

        if (!user) {
            navigate("/"); // Si no hay usuario, redirigir.
        }
    }, [user])

    return (
        <>
            <aside>
                <button onClick={handleInscriptions} className='export-button'>Listar Inscripciones</button>
                <button onClick={handleEvents} className='export-button'>Listar Eventos</button>
            </aside>
            <LineaNeon />
            <main>
                {(!inscriptions && !events) && (
                    <div className='welcome-container'>
                        <h2>Bienvenido/a</h2>
                        {user && (<h3>{user.user_metadata.name}</h3>)}
                    </div>
                )}
                {inscriptions && (<InscriptionsList />)}
                {events && (<EventsList />)}
            </main>
        </>
    )
}

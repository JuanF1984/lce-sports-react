import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/UseAuth'

import { LineaNeon } from '../../common/LineaNeon'

import { EventsList } from './events/EventsList'
import InscriptionsList from './InsciptionList/InscriptionsList'
import EmailMasivo from './emailMasivo/EmailMasivo'
import EmailsInvalidos from './emailsInvalidos/EmailsInvalidos'

export const DashboardAdmin = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [view, setView] = useState(null) // 'inscriptions' | 'events' | 'emailMasivo' | 'emailsInvalidos'

    const setView_ = (v) => setView(v)

    useEffect(() => {
        if (!user) {
            navigate("/");
        }
    }, [user])

    return (
        <>
            <aside>
                <button onClick={() => setView_('inscriptions')} className='export-button'>Listar Inscripciones</button>
                <button onClick={() => setView_('events')} className='export-button'>Listar Eventos</button>
                <button onClick={() => setView_('emailMasivo')} className='export-button'>Email Masivo</button>
                <button onClick={() => setView_('emailsInvalidos')} className='export-button'>Emails Inválidos</button>
            </aside>
            <LineaNeon />
            <main>
                {!view && (
                    <div className='welcome-container'>
                        <h2>Bienvenido/a</h2>
                        {user && (<h3>{user.user_metadata.name}</h3>)}
                    </div>
                )}
                {view === 'inscriptions' && <InscriptionsList />}
                {view === 'events' && <EventsList />}
                {view === 'emailMasivo' && <EmailMasivo />}
                {view === 'emailsInvalidos' && <EmailsInvalidos />}
            </main>
        </>
    )
}

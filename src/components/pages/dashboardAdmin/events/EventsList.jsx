import {useState} from 'react'
import { AddTournamentForm } from '../InsciptionList/AddTournamentForm';

export const EventsList = () => {
  const [showModal, setShowModal] = useState(false);
    
    
    return (
        <main>
            <h2 className='titulos-admin'>Lista de Eventos</h2>
            <button className="export-button" onClick={() => setShowModal(true)}>Cargar Evento</button>
            {showModal && <Modal closeModal={() => setShowModal(false)} />}
        </main>


    )

    
}

const Modal = ({ closeModal }) => (
    <div className="modal-torneo">
        <div className="modal-content">
            <button onClick={closeModal}>Cerrar</button>
            <AddTournamentForm />
        </div>
    </div>
);
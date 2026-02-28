import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmInscriptionModal } from './ConfirmInscriptionModal';

export const InscriptionButton = ({ eventId, localidad, slug, fecha }) => {
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);

    const handleConfirm = () => {
        setShowModal(false);
        navigate(`/formulario/${slug}`);
    };

    return (
        <>
            <button className="main-button inscripcion-btn-event" onClick={() => setShowModal(true)}>
                ¡Inscripción {localidad}!
            </button>

            {showModal && (
                <ConfirmInscriptionModal
                    localidad={localidad}
                    fecha={fecha}
                    onConfirm={handleConfirm}
                    onCancel={() => setShowModal(false)}
                />
            )}
        </>
    );
};

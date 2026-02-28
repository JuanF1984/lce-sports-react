import '@styles/ConfirmInscriptionModal.css';

export const ConfirmInscriptionModal = ({ localidad, fecha, onConfirm, onCancel }) => {
    return (
        <div className="confirm-overlay" onClick={onCancel}>
            <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                <p className="confirm-modal-pretitle">Confirmar inscripción</p>

                <p className="confirm-modal-localidad">{localidad}</p>

                {fecha && (
                    <p className="confirm-modal-fecha">{fecha}</p>
                )}

                <p className="confirm-modal-question">
                    ¿Querés participar en este torneo?
                </p>

                <div className="confirm-modal-actions">
                    <button className="main-button confirm-modal-confirm" onClick={onConfirm}>
                        ¡Me inscribo!
                    </button>
                    <button className="confirm-modal-cancel" onClick={onCancel}>
                        Volver
                    </button>
                </div>
            </div>
        </div>
    );
};

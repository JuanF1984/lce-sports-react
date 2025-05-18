import { useNavigate } from 'react-router-dom';

export const InscriptionButton = ({ eventId }) => {
    const navigate = useNavigate();
    
    const handleTournamentClick = () => {
        // Navegar al formulario pasando el ID del evento como state
        navigate('/formulario', { state: { eventId } });
    };
    
    return (
        <div className="container">
            <button className="main-button" onClick={handleTournamentClick}>
                ¡Inscribite!
            </button>
        </div>
    );
};
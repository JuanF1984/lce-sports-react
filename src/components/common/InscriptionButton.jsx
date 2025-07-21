import { useNavigate } from 'react-router-dom';

export const InscriptionButton = ({ eventId, localidad, slug }) => {
    const navigate = useNavigate();
    
    const handleTournamentClick = () => {
        // Navegar al formulario pasando el ID del evento como state
        // navigate('/formulario', { state: { eventId } });
        navigate(`/formulario/${slug}`);
    };
    
    return (
        <div className="container">
            <button className="main-button" onClick={handleTournamentClick}>
                ¡Inscripción {localidad}!
            </button>
        </div>
    );
};
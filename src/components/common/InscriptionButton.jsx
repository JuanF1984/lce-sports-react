import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const InscriptionButton = ({ onLoadComplete }) => {
    const navigate = useNavigate();

    // Llamar a onLoadComplete cuando el componente se monte
    useEffect(() => {
        onLoadComplete?.();
    }, [onLoadComplete]);

    const handleTournamentClick = () => {
        navigate('/formulario');
    };

    return (
        <div className="container">
            <button className="main-button" onClick={handleTournamentClick}>
                ¡Inscribite!
            </button>
        </div>
    );
};

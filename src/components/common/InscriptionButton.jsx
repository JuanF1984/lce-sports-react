import { useState, useEffect } from 'react';
import { AuthModal } from '../layout/header/AuthModal';
import { useAuth } from '../../context/UseAuth';
import { useNavigate } from 'react-router-dom';

export const InscriptionButton = ({ onLoadComplete}) => {
    const [showAuthModal, setShowAuthModal] = useState(false);
    // Añadir estado para intendedDestination
    const [intendedDestination, setIntendedDestination] = useState(null);
    const { user, isLoading } = useAuth();
    const navigate = useNavigate();

    // Cuando el componente se monta, verificar si hay una ruta guardada
    useEffect(() => {
        const savedDestination = localStorage.getItem('intendedDestination');
        if (savedDestination) {
            setIntendedDestination(savedDestination);
        }
        if (!isLoading && !savedDestination) {
            onLoadComplete?.();
        }
    }, [isLoading, onLoadComplete]);

    const handleTournamentClick = () => {
        if (user) {
            navigate('/formulario');
        } else {
            localStorage.setItem('intendedDestination', '/formulario');
            setIntendedDestination('/formulario'); // Actualizar el estado también
            setShowAuthModal(true);
        }
    };

    useEffect(() => {
        if (intendedDestination && user) {
            navigate(intendedDestination);
            localStorage.removeItem('intendedDestination');
            setIntendedDestination(null); // Limpiar el estado
        } else if (!intendedDestination) {
            onLoadComplete?.();
        } 
    }, [user, intendedDestination, navigate, onLoadComplete]);

    return (
        <>
            <div className="container">
                <button className="main-button" onClick={handleTournamentClick}>
                    Inscribirse en Torneo
                </button>
            </div>
            {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        </>
    );
};

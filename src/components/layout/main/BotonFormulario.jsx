// BotonFormulario.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../../../utils/supabase';
import { AuthModal } from '../../layout/header/AuthModalP';

export const BotonFormulario = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const navigate = useNavigate();

    // Verificar el estado de autenticación
    useEffect(() => {
        const checkAuthStatus = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;
                setIsAuthenticated(!!session);
            } catch (err) {
                console.error("Error checking auth status:", err.message);
            }
        };

        checkAuthStatus();
    }, []);

    // Función para manejar la autenticación y redirigir
    const handleButtonClick = () => {
        if (isAuthenticated) {
            navigate('/formulario');
        } else {
            setShowAuthModal(true);
        }
    };

    // Función de éxito de autenticación
    const handleAuthSuccess = () => {
        setShowAuthModal(false);
        navigate('/formulario'); // Redirigir al formulario después de login
    };

    return (
        <>
            <button onClick={handleButtonClick}>¡Inscribite!</button>

            {/* Mostrar modal solo si el usuario no está autenticado */}
            {showAuthModal && (
                <AuthModal
                    onClose={() => setShowAuthModal(false)}
                    onAuthSuccess={handleAuthSuccess}  // Pasa el callback
                />
            )}
        </>
    );
};

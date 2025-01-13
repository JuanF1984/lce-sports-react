import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import supabase from "../../../utils/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle, faFacebook } from "@fortawesome/free-brands-svg-icons";
import "./styles/AuthModal.css";

export const AuthModal = ({ onClose, onAuthSuccess }) => {
    const [error, setError] = useState(null);
    const location = useLocation();

    useEffect(() => {
        // Manejar cambios en el estado de autenticación
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && session) {
                if (onAuthSuccess) {
                    onAuthSuccess(session);
                }
                onClose();
            }
        });

        // Limpiar el listener cuando el componente se desmonte
        return () => {
            if (authListener?.unsubscribe) {
                authListener.unsubscribe();
            }
        };
    }, [onAuthSuccess, onClose]);

    const redirectUrl = window.location.origin + "/lce-sports-react"+location.pathname;
    
    const handleOAuthLogin = async (provider) => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: redirectUrl,
                }
            });

            if (error) throw error;
        } catch (error) {
            setError(error.message);
            console.error("Error de autenticación:", error);
        }
    };

    return (
        <div className="modalAuth-overlay" onClick={onClose}>
            <div
                className="modalAuth-content"
                onClick={(e) => e.stopPropagation()}
            >
                <button className="modalAuth-close" onClick={onClose}>
                    ×
                </button>

                <h2>Iniciar Sesión</h2>

                {error && (
                    <p className="error-message">{error}</p>
                )}

                <div className="oauth-buttons">
                    <button
                        onClick={() => handleOAuthLogin("google")}
                        className="oauth-button google-button"
                    >
                        <FontAwesomeIcon icon={faGoogle} size="lg" />
                        Continuar con Google
                    </button>

                    <button
                        onClick={() => handleOAuthLogin("facebook")}
                        className="oauth-button facebook-button"
                    >
                        <FontAwesomeIcon icon={faFacebook} size="lg" />
                        Continuar con Facebook
                    </button>
                </div>
            </div>
        </div>
    );
};


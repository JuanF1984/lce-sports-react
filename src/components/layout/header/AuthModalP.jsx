import { useState, useEffect } from "react";
import supabase from "../../../utils/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle, faFacebook } from "@fortawesome/free-brands-svg-icons";

import "./styles/AuthModal.css";

export const AuthModal = ({ onClose, onAuthSuccess }) => {
    const [error, setError] = useState(null);

    useEffect(() => {
        // Guardar la posición del scroll antes de redirigir al login
        const saveScrollPosition = () => {
            sessionStorage.setItem("scrollY", window.scrollY);
        };

        // Llamar a saveScrollPosition cuando el modal se abra
        window.addEventListener("beforeunload", saveScrollPosition);

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === "SIGNED_IN" && session) {
                    if (onAuthSuccess) {
                        onAuthSuccess(session);
                    }
                    onClose();

                    // Recuperar la posición del scroll
                    const savedScrollY = sessionStorage.getItem("scrollY");
                    if (savedScrollY) {
                        window.scrollTo(0, parseInt(savedScrollY, 10));
                    }
                }
            }
        );

        const handleHashFragment = async () => {
            if (window.location.hash) {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (session && !error) {
                    if (onAuthSuccess) {
                        onAuthSuccess(session);
                    }
                    onClose();

                    // Recuperar la posición del scroll
                    const savedScrollY = sessionStorage.getItem("scrollY");
                    if (savedScrollY) {
                        window.scrollTo(0, parseInt(savedScrollY, 10));
                    }

                    window.history.replaceState(null, "", window.location.pathname); // Limpiar el hash
                    sessionStorage.removeItem("scrollY"); // Limpiar la posición del scroll almacenada
                }
            }
        };

        handleHashFragment();

        return () => {
            if (authListener?.unsubscribe) {
                authListener.unsubscribe();
            }
            window.removeEventListener("beforeunload", saveScrollPosition);
        };
    }, [onAuthSuccess, onClose]);

    const handleOAuthLogin = async (provider) => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: window.location.origin + window.location.pathname,
                },
            });
            if (error) throw error;
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="modalAuth-overlay" onClick={onClose}>
            <div className="modalAuth-content" onClick={(e) => e.stopPropagation()}>
                <button className="modalAuth-close" onClick={onClose}>×</button>
                <h2>Iniciar Sesión</h2>

                {error && <p className="error-message">{error}</p>}

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


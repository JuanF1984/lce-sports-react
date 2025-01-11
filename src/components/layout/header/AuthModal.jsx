import { useState } from "react";
import supabase from "../../../utils/supabase";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle, faFacebook } from '@fortawesome/free-brands-svg-icons';

import './styles/AuthModal.css';

export const AuthModal = ({ onClose, onAuthSuccess }) => {

    const [error, setError] = useState(null);

    const handleOAuthLogin = async (provider) => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider,
            });
            if (error) throw error;
            onClose();
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>
                <h2>Iniciar Sesión</h2>

                {error && (
                    <p className="error-message">{error}</p>
                )}

                <div className="oauth-buttons">
                    <button
                        onClick={() => handleOAuthLogin('google')}
                        className="oauth-button google-button"
                    >
                        <FontAwesomeIcon icon={faGoogle} size="lg" />
                        Continuar con Google
                    </button>

                    <button
                        onClick={() => handleOAuthLogin('facebook')}
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

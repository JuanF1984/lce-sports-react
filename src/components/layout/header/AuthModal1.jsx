import { useState } from "react";
import supabase from "../../../utils/supabase";
import "./styles/AuthModal.css";

export const AuthModal = ({ onClose, onAuthSuccess }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState("");

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage("");

        try {
            if (isRegistering) {
                // Registro de usuario
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;

                setSuccessMessage("Registro exitoso. Por favor, revisa tu email para confirmar tu cuenta.");
                setEmail("");
                setPassword("");
            } else {
                // Inicio de sesión
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;

                // Verificar rol en tabla "profiles"
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", data.user.id)
                    .single();

                onAuthSuccess(data.user.email, profile?.role);
            }
        } catch (error) {
            setError(error.message);
        }
    };

    const handleOAuthLogin = async (provider) => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({ provider });
            if (error) throw error;
            onClose();
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>
                <h2>{isRegistering ? "Registrarse" : "Iniciar Sesión"}</h2>

                <form onSubmit={handleEmailAuth} className="auth-form">
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}
                    {successMessage && <p className="success-message">{successMessage}</p>}

                    <button type="submit" className="auth-button primary-button">
                        {isRegistering ? "Registrarse" : "Iniciar Sesión"}
                    </button>
                </form>

                <div className="oauth-buttons">
                    <button onClick={() => handleOAuthLogin("google")} className="oauth-button google-button">
                        Continuar con Google
                    </button>
                    <button onClick={() => handleOAuthLogin("facebook")} className="oauth-button facebook-button">
                        Continuar con Facebook
                    </button>
                </div>

                <button onClick={() => setIsRegistering(!isRegistering)} className="toggle-auth">
                    {isRegistering
                        ? "¿Ya tienes cuenta? Inicia sesión"
                        : "¿No tienes cuenta? Regístrate"}
                </button>
            </div>
        </div>
    );
};

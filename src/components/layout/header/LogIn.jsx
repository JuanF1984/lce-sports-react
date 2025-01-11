import supabase from "../../../utils/supabase";

export const LogIn = ({ closeModal }) => {
    const handleLogin = async (provider) => {
        const { user, session, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
        });

        if (error) {
            console.error('Error durante el login:', error.message);
        } else {
            closeModal(); // Cierra el modal cuando el login sea exitoso
        }
    };

    return (
        <div className="login-modal">
            <h2>Iniciar sesión</h2>
            <button onClick={() => handleLogin('google')}>Iniciar sesión con Google</button>
            <button onClick={() => handleLogin('facebook')}>Iniciar sesión con Facebook</button>
        </div>
    );
}

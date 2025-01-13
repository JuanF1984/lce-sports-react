import { useEffect, useState } from 'react';
import supabase from "../../../utils/supabase";

import { useNavigate } from 'react-router-dom';


import { AuthModal } from './AuthModal';

export const LogIn = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);



    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                setIsAuthenticated(true);
                setUserEmail(session.user.email);

                const fetchRole = async () => {
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', session.user.id)
                        .single();
                    if (error) {
                        console.error('Error fetching profile:', error.message);
                        setIsAdmin(false);
                    } else {
                        setIsAdmin(profile?.role === 'admin');
                    }
                };
                fetchRole();
            } else {
                setIsAuthenticated(false);
                setUserEmail('');
                setIsAdmin(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            // Reset manual (por si el evento falla)
            setIsAuthenticated(false);
            setUserEmail('');
            setIsAdmin(false);
        } catch (error) {
            console.error('Error al cerrar sesión:', error.message);
        }
    };

    const InscripcionButton = () => {
        const navigate = useNavigate();

        const handleClick = () => {
            navigate("/inscriptions"); // Redirige a la página del formulario
        };

        return (
                <button className='admin-button' onClick={handleClick}>
                    Panel Admin
                </button>
        );
    };


    return (
        <>
            <div className="auth-section">
                {isAuthenticated ? (
                    <>
                        {/* por el momento no vemos el user-mail hasta que no trabajemos los estilos */}
                        {/* <span className="user-email">{userEmail}</span> */}
                        <div className='auth-buttons'>
                            {isAdmin && (
                                // <button className="admin-button">
                                //     Panel Admin
                                // </button>
                                <InscripcionButton />
                            )}
                            <button
                                className="logout-button"
                                onClick={handleLogout}
                            >
                                Cerrar Sesión
                            </button>
                        </div>
                    </>
                ) : (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="login-button"
                    >
                        Iniciar Sesión
                    </button>
                )}
            </div>
            {isModalOpen && (
                <AuthModal
                    onClose={() => setIsModalOpen(false)}
                    onAuthSuccess={() => { }}
                />
            )}
        </>
    );
};

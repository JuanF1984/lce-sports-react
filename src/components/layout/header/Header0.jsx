import { useEffect, useState } from 'react'

import supabase from "../../../utils/supabase";

import '@styles/Header.css'
import logo from '@img/a.png'

import { NavBar } from './NavBar'
import { LogIn } from './LogIn'
import { AuthModal } from './AuthModal0';

export const Header = ({ onLoadComplete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [userEmail, setUserEmail] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        const img = new Image()
        img.src = logo
        img.onload = () => onLoadComplete?.()
    }, [onLoadComplete])

    const handleAuthSuccess = (email, role) => {
        setIsAuthenticated(true)
        setUserEmail(email)
        setIsAdmin(role === 'admin')
        setIsModalOpen(false)
    }

    // const handleLogout = () => {
    //     setIsAuthenticated(false)
    //     setUserEmail('')
    //     setIsAdmin(false)
    // }

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                setIsAuthenticated(true);
                setUserEmail(session.user.email);

                // Obtener el rol del usuario
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
            } else {
                // Usuario no autenticado
                setIsAuthenticated(false);
                setUserEmail('');
                setIsAdmin(false);
            }
        });

        // Limpieza de la suscripción al desmontar el componente
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                setIsAuthenticated(true);
                setUserEmail(session.user.email);

                // Obtener el rol del usuario
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
            } else {
                // Usuario no autenticado
                setIsAuthenticated(false);
                setUserEmail('');
                setIsAdmin(false);
            }
        });

        // Limpieza de la suscripción al desmontar el componente
        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
    
            // Aunque `onAuthStateChange` debería manejar esto, puedes resetear manualmente
            setIsAuthenticated(false);
            setUserEmail('');
            setIsAdmin(false);
        } catch (error) {
            console.error('Error al cerrar sesión:', error.message);
        }
    };

    return (
        <header className="header">
            <div className="header-superior">
                <img src={logo} alt="Logo de LC E-Sports" />
            </div>
            <NavBar />
            <div className="auth-section">
                {isAuthenticated ? (
                    <>
                        <span className="user-email">{userEmail}</span>
                        {isAdmin && (
                            <button className="admin-button">
                                Panel Admin
                            </button>
                        )}
                        <button
                            className="logout-button"
                            onClick={handleLogout}
                        >
                            Cerrar Sesión
                        </button>
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
                    onAuthSuccess={handleAuthSuccess}
                />
            )}
        </header>
    )
}
import { useEffect, useState } from 'react';
import supabase from "../../../utils/supabase";

import { Link } from 'react-router-dom';

import '@styles/Header.css';
import logo from '@img/a.png';

import { NavBar } from './NavBar';
import { AuthModal } from './AuthModal';

export const Header = ({ onLoadComplete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.src = logo;
        img.onload = () => onLoadComplete?.();
    }, [onLoadComplete]);

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

    return (
        <header className="header">
            <div className="header-superior">
                <Link to="/">
                    <img src={logo} alt="Logo de LC E-Sports" />
                </Link>
            </div>
            <NavBar />
            <div className="auth-section">
                {isAuthenticated ? (
                    <>
                        <span className="user-email">{userEmail}</span>
                        <div className='auth-buttons'>
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
        </header>
    );
};

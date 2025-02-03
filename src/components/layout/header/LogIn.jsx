import { useEffect, useState } from 'react';
import supabase from "../../../utils/supabase";

import { useNavigate } from 'react-router-dom';

import { useUserInscriptions } from '../../../hooks/useUserInscriptions ';


import { AuthModal } from './AuthModal';

export const LogIn = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [userId, setUserId] = useState('')
    const [isOpen, setIsOpen] = useState(false);

    const { data, loading, error } = useUserInscriptions(userId ? userId : '')

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                setIsAuthenticated(true);
                setUserEmail(session.user.email);
                setUserId(session.user.id)
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

    const PanelAdmin = () => {
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

    const VerInscripcion = () => {
        const handleClick = () => {
            setIsOpen(true)
        }

        return (
            <button className='admin-button' onClick={handleClick}>
                Ver inscripciones
            </button>
        )
    }


    return (
        <>
            <div className="auth-section">
                {isAuthenticated ? (
                    <>
                        {/* por el momento no vemos el user-mail hasta que no trabajemos los estilos */}
                        {/* <span className="user-email">{userEmail}</span> */}
                        <div className='auth-buttons'>
                            {isAdmin ? (
                                <PanelAdmin />
                            ) : (
                                <VerInscripcion />
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

            {isOpen && (
                <div className="modal">
                    <div className="modal-content">
                        <button onClick={() => setIsOpen(false)}>Cerrar</button>
                        <h2>Inscripciones del Usuario</h2>
                        <table className='table-inscriptions'>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Evento</th>
                                    <th>Juegos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.inscriptions.length > 0 ? (
                                    data.inscriptions.map((insc) => {
                                        const event = data.events.find((e) => e.id === insc.id_evento);
                                        const games = data.games
                                            .filter((g) =>
                                                data.inscriptions.some((i) => i.id === insc.id && data.games.some((game) => game.id === g.id))
                                            )
                                            .map((g) => g.name)
                                            .join(", ");

                                        return (
                                            <tr key={insc.id}>
                                                <td>{insc.nombreCompleto}</td>
                                                <td>{event ? event.name : "Sin evento"}</td>
                                                <td>{games || "Sin juegos"}</td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="3">No hay inscripciones registradas.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
};

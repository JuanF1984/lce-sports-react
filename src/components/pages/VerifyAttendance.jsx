import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import supabase from '../../utils/supabase';
import { useAuth } from '../../context/UseAuth';
import '../../styles/VerifyAttendance.css';

const VerifyAttendance = () => {
    // Extraer parametros de la URL 
    const { eventoId, inscripcionId, token } = useParams();
    const navigate = useNavigate();

    // Utilización del contexto de autenticación
    const { user, isLoading } = useAuth();

    const [message, setMessage] = useState('');
    const [attendeeInfo, setAttendeeInfo] = useState(null);
    const [evento, setEvento] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [status, setStatus] = useState('loading');

    // Verificación de rol de usuario
    useEffect(() => {
        const checkUserRole = async () => {
            if (isLoading) return;

            // Si no hay usuario, redirigir a página principal
            if (!user) {
                navigate('/', {
                    state: {
                        returnUrl: `/verify-attendance/${eventoId}/${inscripcionId}`,
                        message: 'Debes iniciar sesión para verificar asistencias'
                    }
                });
                return;
            }

            try {
                // Consultamos el perfil del usuario para verificar su rol
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                setUserRole(profile?.role || null);

                // Verificamos si el rol permite verificar asistencias
                if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
                    setStatus('error');
                    setMessage('No tienes permisos para verificar asistencias');
                    return;
                }

                // Si pasó todas las verificaciones, marcar como verificado
                setAuthChecked(true);

            } catch (error) {
                console.error('Error al verificar el rol del usuario:', error);
                setStatus('error');
                setMessage('Error al verificar tus permisos');
            }
        };

        checkUserRole();
    }, [user, isLoading, navigate, eventoId, inscripcionId]);

    // Una vez verificada la autenticación, procesamos la asistencia
    useEffect(() => {
        if (!authChecked) return;

        const verifyAttendance = async () => {
            try {
                // 1. Verificamos si la inscripción existe (solo por ID)
                const { data: inscripcion, error: inscripcionError } = await supabase
                    .from('inscriptions')
                    .select('*')
                    .eq('id', inscripcionId)
                    .single();

                if (inscripcionError || !inscripcion) {
                    throw new Error('No se encontró la inscripción');
                }

                // 2. Verificamos si el evento coincide
                if (inscripcion.id_evento !== eventoId) {
                    throw new Error('El evento no coincide con la inscripción');
                }

                // 3. Buscamos la información del evento por separado
                const { data: eventoData, error: eventoError } = await supabase
                    .from('events') // Tabla 'events' (no 'eventos')
                    .select('*')
                    .eq('id', eventoId)
                    .single();

                if (eventoError || !eventoData) {
                    throw new Error('No se encontró información del evento');
                }

                // 4. Verificar si ya se registró la asistencia
                if (inscripcion.asistencia) {
                    setStatus('already-verified');
                    setMessage(`¡Asistencia ya registrada para ${inscripcion.nombre} ${inscripcion.apellido}!`);
                    setAttendeeInfo(inscripcion);
                    setEvento(eventoData);
                    return;
                }

                // 5. Registrar la asistencia
                const { error: updateError } = await supabase
                    .from('inscriptions')
                    .update({
                        asistencia: true,
                        fecha_asistencia: new Date().toISOString()
                    })
                    .eq('id', inscripcion.id);

                if (updateError) {
                    throw new Error('Error al registrar la asistencia en la base de datos');
                }

                // 6. Actualizar UI con éxito
                setStatus('success');
                setMessage(`¡Asistencia registrada con éxito para ${inscripcion.nombre} ${inscripcion.apellido}!`);
                setAttendeeInfo(inscripcion);
                setEvento(eventoData);

            } catch (error) {
                console.error('Error al verificar asistencia:', error);
                setStatus('error');
                setMessage(error.message || 'Error al verificar la asistencia');
            }
        };

        verifyAttendance();
    }, [authChecked, eventoId, inscripcionId]);

    return (
        <div className="verify-attendance-container">
            <div className="verify-card">
                {status === 'loading' && (
                    <div className="loading-message">
                        <div className="loading-spinner"></div>
                        <h2>Verificando asistencia...</h2>
                        <p>Por favor espera mientras procesamos tu información.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="success-message">
                        <div className="success-icon">✓</div>
                        <h2>¡Bienvenido al evento!</h2>
                        <p>{message}</p>

                        {attendeeInfo && evento && (
                            <div className="attendee-details">
                                <h3>Detalles de la inscripción</h3>
                                <p><strong>Evento:</strong> {evento.nombre}</p>
                                <p><strong>Fecha:</strong> {evento.fecha_inicio}</p>
                                <p><strong>Hora:</strong> {evento.hora_inicio}</p>
                                <p><strong>Lugar:</strong> {evento.localidad}</p>
                                <p><strong>Asistente:</strong> {attendeeInfo.nombre} {attendeeInfo.apellido}</p>
                            </div>
                        )}
                    </div>
                )}

                {status === 'already-verified' && (
                    <div className="info-message">
                        <div className="info-icon">ℹ</div>
                        <h2>Asistencia ya verificada</h2>
                        <p>{message}</p>

                        {attendeeInfo && evento && (
                            <div className="attendee-details">
                                <h3>Detalles de la inscripción</h3>
                                <p><strong>Evento:</strong> {evento.nombre}</p>
                                <p><strong>Fecha:</strong> {evento.fecha_inicio}</p>
                                <p><strong>Hora:</strong> {evento.hora_inicio}</p>
                                <p><strong>Lugar:</strong> {evento.localidad}</p>
                                <p><strong>Asistente:</strong> {attendeeInfo.nombre} {attendeeInfo.apellido}</p>
                                <p><strong>Verificado el:</strong> {new Date(attendeeInfo.fecha_asistencia).toLocaleString()}</p>
                            </div>
                        )}
                    </div>
                )}

                {status === 'error' && (
                    <div className="error-message">
                        <div className="error-icon">✗</div>
                        <h2>Error de verificación</h2>
                        <p>{message}</p>
                        <button
                            className="retry-button"
                            onClick={() => window.location.reload()}
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                <div className="actions">
                    <button
                        className="home-button"
                        onClick={() => navigate('/')}
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VerifyAttendance;
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import supabase from '../../utils/supabase';
import '../../styles/VerifyAttendance.css';

const VerifyAttendance = () => {
  // Extraemos los parámetros de la URL
  const { eventoId, inscripcionId, token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [attendeeInfo, setAttendeeInfo] = useState(null);
  const [evento, setEvento] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const verifyAttendance = async () => {
      try {
        console.log('Verificando con los parámetros:', { eventoId, inscripcionId, token });
        
        // 1. Verificamos si la inscripción existe (solo por ID)
        const { data: inscripcion, error: inscripcionError } = await supabase
          .from('inscriptions')
          .select('*')
          .eq('id', inscripcionId)
          .single();
        
        console.log('Consulta de inscripción por ID:', { inscripcion, inscripcionError });
        
        if (inscripcionError || !inscripcion) {
          console.error('Error al buscar inscripción por ID:', inscripcionError);
          setDebugInfo({
            error: 'Error al buscar inscripción por ID',
            params: { inscripcionId, eventoId, token },
            errorDetails: inscripcionError
          });
          throw new Error('No se encontró la inscripción');
        }
        
        // 2. Verificamos si el evento coincide
        if (inscripcion.id_evento !== eventoId) {
          console.error('El ID del evento no coincide con la inscripción');
          setDebugInfo({
            error: 'ID de evento no coincide',
            params: { inscripcionId, eventoId, token },
            inscriptionData: { evento_id: inscripcion.id_evento }
          });
          throw new Error('El evento no coincide con la inscripción');
        }
        
        // 3. Buscamos la información del evento por separado
        const { data: eventoData, error: eventoError } = await supabase
          .from('events') // CORREGIDO: cambiamos 'eventos' a 'events'
          .select('*')
          .eq('id', eventoId)
          .single();
          
        if (eventoError || !eventoData) {
          console.error('Error al buscar evento:', eventoError);
          setDebugInfo({
            error: 'Error al buscar evento',
            params: { eventoId },
            errorDetails: eventoError
          });
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
          console.error('Error al actualizar asistencia:', updateError);
          setDebugInfo({
            error: 'Error al actualizar asistencia',
            errorDetails: updateError
          });
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
  }, [eventoId, inscripcionId, token]);

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
            
            {/* Información de depuración en modo desarrollo */}
            {process.env.NODE_ENV === 'development' && debugInfo && (
              <div className="debug-info" style={{textAlign: 'left', fontSize: '12px', padding: '10px', background: '#f1f1f1', borderRadius: '4px', marginTop: '20px', overflowX: 'auto'}}>
                <h4>Información de depuración:</h4>
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            )}
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
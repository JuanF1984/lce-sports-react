import { useState, useEffect } from 'react';
import { useProximosEventos } from '../../../../hooks/useProximosEventos';
import { InscriptionButton } from '../../../common/InscriptionButton';
import { formatearFecha, formatearHora } from '../../../../utils/dateUtils';
import './RelojRegresivo.css';

export const RelojRegresivo = ({ onEventoStatusChange, maxEventos = 2 }) => {
    const [eventosConTiempo, setEventosConTiempo] = useState([]);
    const { proximosEventos, loading, error } = useProximosEventos(maxEventos);
    const [hayEventos, setHayEventos] = useState(false);

    useEffect(() => {
        // Verificamos si hay eventos después de cargar
        if (!loading) {
            // Esto funciona correctamente incluso si hay menos eventos que 'maxEventos'
            const existenEventos = proximosEventos && proximosEventos.length > 0;
            setHayEventos(existenEventos);

            // Notificamos al componente padre si hay eventos
            if (onEventoStatusChange) {
                onEventoStatusChange(existenEventos);
            }

            if (!existenEventos) return;
        }

        if (loading || !proximosEventos || proximosEventos.length === 0) return;

        // Inicializamos los tiempos para cada evento
        const inicializarTiempos = () => {
            return proximosEventos.map(evento => ({
                ...evento,
                timeRemaining: calcularTiempoRestante(evento.fecha_fin),
                activo: new Date(`${evento.fecha_fin} 23:59:59`).getTime() > new Date().getTime()
            }));
        };

        setEventosConTiempo(inicializarTiempos());

        // Función para calcular el tiempo restante
        function calcularTiempoRestante(fechaFin) {
            const endDate = new Date(`${fechaFin} 23:59:59`).getTime();
            const now = new Date().getTime();
            const timeDiff = endDate - now;

            if (timeDiff <= 0) {
                return null; // Evento finalizado
            }

            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

            return {
                days: days < 10 ? `0${days}` : `${days}`,
                hours: hours < 10 ? `0${hours}` : `${hours}`,
                minutes: minutes < 10 ? `0${minutes}` : `${minutes}`,
                seconds: seconds < 10 ? `0${seconds}` : `${seconds}`,
            };
        }

        // Actualizar los relojes cada segundo
        const timer = setInterval(() => {
            setEventosConTiempo(prevEventos => {
                const eventosActualizados = prevEventos.map(evento => ({
                    ...evento,
                    timeRemaining: calcularTiempoRestante(evento.fecha_fin),
                    activo: new Date(`${evento.fecha_fin} 23:59:59`).getTime() > new Date().getTime()
                }));

                // Verificamos si hay al menos un evento activo
                const alMenosUnEventoActivo = eventosActualizados.some(e => e.activo);

                if (hayEventos !== alMenosUnEventoActivo) {
                    setHayEventos(alMenosUnEventoActivo);
                    if (onEventoStatusChange) {
                        onEventoStatusChange(alMenosUnEventoActivo);
                    }
                }

                return eventosActualizados;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [loading, proximosEventos, onEventoStatusChange, hayEventos]);

    return (
        <section className="reloj" id="reloj">
            <div className="container-reloj">
                <h3>Próximos Eventos</h3>

                {loading ? (
                    <p>Cargando...</p>
                ) : error ? (
                    <p>Error al cargar los eventos: {error.message}</p>
                ) : (
                    <>
                        {hayEventos ? (
                            <div className="eventos-container">
                                {/* Este map se ejecutará para todos los eventos disponibles, 
                                    incluso si son menos que maxEventos */}
                                {eventosConTiempo.map((evento, index) => (
                                    <div key={evento.id || index} className="evento-item">
                                        <div className="evento-info">
                                            <p className="evento-localidad">{evento.localidad}</p>
                                            <p className="evento-fecha">
                                                {formatearFecha(evento.fecha_inicio)}
                                                {evento.hora_inicio && ` - ${formatearHora(evento.hora_inicio)}`}
                                            </p>
                                        </div>

                                        {evento.activo && evento.timeRemaining ? (
                                            <div className="clock">
                                                <div className="time-container">
                                                    <div className="time" id="days">{evento.timeRemaining.days}</div>
                                                    <div className="label">Días</div>
                                                </div>
                                                <div className="time-container">
                                                    <div className="time" id="hours">{evento.timeRemaining.hours}</div>
                                                    <div className="label">Horas</div>
                                                </div>
                                                <div className="time-container">
                                                    <div className="time" id="minutes">{evento.timeRemaining.minutes}</div>
                                                    <div className="label">Minutos</div>
                                                </div>
                                                <div className="time-container">
                                                    <div className="time" id="seconds">{evento.timeRemaining.seconds}</div>
                                                    <div className="label">Segundos</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="final-message">¡Evento Finalizado!</div>
                                        )}

                                        {/* Botón de inscripción para cada evento activo */}
                                        {evento.activo && (
                                            <div className="inscripcion-container">
                                                <InscriptionButton eventId={evento.id} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="clock">
                                <div className="no-event-message">No hay eventos próximos registrados</div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
};
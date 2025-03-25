import { useState, useEffect } from 'react'
import { useProximoEvento } from '../../../../hooks/useProximoEvento';
import './RelojRegresivo.css'

export const RelojRegresivo = ({ onEventoStatusChange }) => {
    const [timeRemaining, setTimeRemaining] = useState({
        days: '00',
        hours: '00',
        minutes: '00',
        seconds: '00',
    });

    const { fecha_fin, localidad, loading } = useProximoEvento();
    const [hayEvento, setHayEvento] = useState(true);

    useEffect(() => {
        // Si no hay fecha_fin después de cargar, no hay evento próximo
        if (!loading && !fecha_fin) {
            setHayEvento(false);
            // Notificamos al componente padre que no hay evento
            if (onEventoStatusChange) {
                onEventoStatusChange(false);
            }
            return;
        }

        if (loading || !fecha_fin) return;

        const endDate = new Date(`${fecha_fin} 23:59:59`).getTime();

        const updateClock = () => {
            const now = new Date().getTime();
            const timeDiff = endDate - now;

            if (timeDiff > 0) {
                setHayEvento(true);
                // Notificamos al componente padre que hay evento
                if (onEventoStatusChange) {
                    onEventoStatusChange(true);
                }

                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

                setTimeRemaining({
                    days: days < 10 ? `0${days}` : `${days}`,
                    hours: hours < 10 ? `0${hours}` : `${hours}`,
                    minutes: minutes < 10 ? `0${minutes}` : `${minutes}`,
                    seconds: seconds < 10 ? `0${seconds}` : `${seconds}`,
                });
            } else {
                setHayEvento(false);
                // Notificamos al componente padre que no hay evento
                if (onEventoStatusChange) {
                    onEventoStatusChange(false);
                }

                setTimeRemaining(null); // Indica que el evento terminó
                clearInterval(timer);
            }
        };

        const timer = setInterval(updateClock, 1000);
        updateClock(); // Llamada inicial
        return () => clearInterval(timer); // Limpieza del intervalo
    }, [loading, fecha_fin, onEventoStatusChange]);

    return (
        <section className="reloj" id='reloj'>
            <div className="container-reloj">
                <h3>Próximo Evento</h3>
                {loading ? (
                    <p>Cargando...</p>
                ) : (
                    <>
                        {hayEvento && fecha_fin ? (
                            <>
                                <p>{localidad}</p>
                                <div className="clock" id="clock">
                                    {timeRemaining ? (
                                        <>
                                            <div className="time" id="days">{timeRemaining.days}</div>
                                            <div className="label">Días</div>
                                            <div className="time" id="hours">{timeRemaining.hours}</div>
                                            <div className="label">Horas</div>
                                            <div className="time" id="minutes">{timeRemaining.minutes}</div>
                                            <div className="label">Minutos</div>
                                            <div className="time" id="seconds">{timeRemaining.seconds}</div>
                                            <div className="label">Segundos</div>
                                        </>
                                    ) : (
                                        <div className="final-message">¡Evento Finalizado!</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="clock" id="clock">
                                <div className="no-event-message">No hay evento próximo registrado</div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    )
}
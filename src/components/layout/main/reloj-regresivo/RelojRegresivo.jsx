import { useState, useEffect } from 'react'

import { useNavigate } from 'react-router-dom'

import './RelojRegresivo.css'

export const RelojRegresivo = () => {
    const [timeRemaining, setTimeRemaining] = useState({
        days: '00',
        hours: '00',
        minutes: '00',
        seconds: '00',
    });

    const endDate = new Date('February 04, 2025 15:00:00').getTime();

    useEffect(() => {
        const updateClock = () => {
            const now = new Date().getTime();
            const timeDiff = endDate - now;

            if (timeDiff > 0) {
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
                setTimeRemaining(null); // Indica que el evento terminó
                clearInterval(timer);
            }
        };

        const timer = setInterval(updateClock, 1000);
        updateClock(); // Llamada inicial
        return () => clearInterval(timer); // Limpieza del intervalo
    }, [endDate]);

    // Componente Boton para abrir el formulario de inscripción
    const InscripcionButton = () => {
        const navigate = useNavigate();

        const handleClick = () => {
            navigate("/formulario"); // Redirige a la página del formulario
        };

        return (
            <div>
                <button onClick={handleClick}>Inscribirse en el torneo</button>
            </div>
        );
    };

    return (
        <section className="reloj" id='reloj'>
            <div className="container-reloj">
                <h3>Próximo Evento</h3>
                <p>Lugar del Evento</p>
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
                <InscripcionButton />
            </div>
        </section>
    )
}

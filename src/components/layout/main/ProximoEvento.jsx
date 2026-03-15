import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useProximosEventos } from '../../../hooks/useProximosEventos';
import { useEventGames } from '../../../hooks/useEventGames';
import { formatearHora } from '../../../utils/dateUtils';

import logo from '@img/logo.webp';
import heroImg from '@img/hero/hero_img1.jpg';

import '@styles/ProximoEvento.css';

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    const dia = String(day).padStart(2, '0');
    const mes = String(month).padStart(2, '0');
    return `${DIAS_CORTOS[fecha.getDay()]} ${dia}/${mes}/${year}`;
};

const calcularCountdown = (fechaFin) => {
    if (!fechaFin) return null;
    const endDate = new Date(`${fechaFin} 23:59:59`).getTime();
    const diff = endDate - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { days, hours };
};

export const ProximoEvento = ({ onLoadComplete }) => {
    const navigate = useNavigate();
    const { proximosEventos, loading } = useProximosEventos(1);
    const evento = proximosEventos?.[0] ?? null;
    const { eventGames } = useEventGames(evento ? [evento.id] : []);
    const juegos = evento ? (eventGames[evento.id] ?? []) : [];

    const [countdown, setCountdown] = useState(null);

    useEffect(() => {
        const img = new Image();
        img.src = heroImg;
        img.onload = () => onLoadComplete?.();
    }, [onLoadComplete]);

    useEffect(() => {
        if (!evento) return;
        setCountdown(calcularCountdown(evento.fecha_fin));
        const timer = setInterval(() => {
            setCountdown(calcularCountdown(evento.fecha_fin));
        }, 60_000);
        return () => clearInterval(timer);
    }, [evento]);

    if (loading) {
        return (
            <section className="proximo-evento">
                <p className="pe-loading">Cargando evento...</p>
            </section>
        );
    }

    if (!evento) {
        return (
            <section className="proximo-evento">
                <h2 className="pe-titulo">Próximo evento</h2>
                <div className="pe-card">
                    <div className="pe-imagen-wrap">
                        <img
                            src={heroImg}
                            alt="LC e-SPORTS"
                            className="pe-imagen"
                        />
                        <img
                            src={logo}
                            alt="LC e-SPORTS"
                            className="pe-logo-overlay"
                        />
                        <div className="pe-vacio-overlay">
                            <p className="pe-vacio-titulo">¡Próximamente nuevos eventos!</p>
                            <p className="pe-vacio-sub">Seguinos en redes para enterarte primero.</p>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="proximo-evento">
            <h2 className="pe-titulo">Próximo evento</h2>

            <div className="pe-card">
                {/* Imagen banner + logo overlay */}
                <div className="pe-imagen-wrap">
                    <img
                        src={evento.imagen_url || heroImg}
                        alt="Evento LC e-SPORTS"
                        className="pe-imagen"
                    />
                    <img
                        src={logo}
                        alt="LC e-SPORTS"
                        className="pe-logo-overlay"
                    />
                </div>

                {/* Datos del evento */}
                <div className="pe-info">
                    <p className="pe-localidad">{evento.localidad}</p>
                    <p className="pe-fecha">
                        {formatearFechaCorta(evento.fecha_inicio)}
                        {evento.hora_inicio && (
                            <> · {formatearHora(evento.hora_inicio)}</>
                        )}
                    </p>
                    {evento.direccion && (
                        <p className="pe-direccion">{evento.direccion}</p>
                    )}

                    {/* Tags de juegos */}
                    {juegos.length > 0 && (
                        <div className="pe-tags">
                            {juegos.map((j) => (
                                <span key={j.id} className="pe-tag">
                                    {j.game_name}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Cupos + countdown */}
                    <div className="pe-cupos-row">
                        <span className="pe-cupos-badge">Cupos por juego</span>
                        {countdown && (
                            <span className="pe-countdown">
                                Faltan{' '}
                                <strong>
                                    {countdown.days} días{' '}
                                    {String(countdown.hours).padStart(2, '0')} h
                                </strong>
                            </span>
                        )}
                    </div>

                    {/* Botón inscripción */}
                    <button
                        className="main-button pe-btn"
                        onClick={() => navigate(`/formulario/${evento.slug}`)}
                    >
                        INSCRIBITE &gt;
                    </button>
                </div>
            </div>
        </section>
    );
};

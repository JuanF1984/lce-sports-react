import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useProximosEventos } from '../../../hooks/useProximosEventos';
import { useEventGames } from '../../../hooks/useEventGames';
import { formatearHora } from '../../../utils/dateUtils';

import logo from '@img/logo.webp';
import heroImg from '@img/hero/hero_img1.jpg';

import '@styles/ProximoEvento.css';

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const formatearRangoFechas = (fechaInicioStr, fechaFinStr) => {
    if (!fechaInicioStr) return '';
    const [yi, mi, di] = fechaInicioStr.split('-').map(Number);
    const inicio = new Date(yi, mi - 1, di);

    if (!fechaFinStr || fechaFinStr === fechaInicioStr) {
        return `${DIAS_CORTOS[inicio.getDay()]} ${String(di).padStart(2,'0')}/${String(mi).padStart(2,'0')}/${yi}`;
    }

    const [yf, mf, df] = fechaFinStr.split('-').map(Number);
    const fin = new Date(yf, mf - 1, df);

    if (mi === mf && yi === yf) {
        return `${DIAS_CORTOS[inicio.getDay()]} ${di} y ${DIAS_CORTOS[fin.getDay()]} ${df} de ${MESES[mi - 1]}`;
    }
    return `${DIAS_CORTOS[inicio.getDay()]} ${String(di).padStart(2,'0')}/${String(mi).padStart(2,'0')} y ${DIAS_CORTOS[fin.getDay()]} ${String(df).padStart(2,'0')}/${String(mf).padStart(2,'0')}`;
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

const EventoCard = ({ evento, juegos, onImageLoad }) => {
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(() => calcularCountdown(evento.fecha_fin));
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        setCountdown(calcularCountdown(evento.fecha_fin));
        const timer = setInterval(() => {
            setCountdown(calcularCountdown(evento.fecha_fin));
        }, 60_000);
        return () => clearInterval(timer);
    }, [evento.fecha_fin]);

    return (
        <>
        <div className="pe-card">
            {/* Imagen banner + logo overlay */}
            <div className="pe-imagen-wrap">
                <img
                    src={evento.imagen_url || heroImg}
                    alt="Evento LC e-SPORTS"
                    className="pe-imagen"
                    onLoad={onImageLoad}
                    onError={onImageLoad}
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
                    {formatearRangoFechas(evento.fecha_inicio, evento.fecha_fin)}
                    {evento.hora_inicio && (
                        <> · {formatearHora(evento.hora_inicio)}</>
                    )}
                </p>
                {evento.direccion && (
                    <p className="pe-direccion">{evento.direccion}</p>
                )}
                {evento.ubicacion_url && (
                    <a
                        href={evento.ubicacion_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pe-ubicacion-link"
                    >
                        📍 Ver ubicación
                    </a>
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
                    onClick={() => setShowConfirm(true)}
                >
                    INSCRIBITE &gt;
                </button>
            </div>
        </div>

        {/* Modal de confirmación */}
        {showConfirm && (
            <div className="pe-confirm-overlay" onClick={() => setShowConfirm(false)}>
                <div className="pe-confirm-modal" onClick={(e) => e.stopPropagation()}>
                    <p className="pe-confirm-titulo">¿Confirmás tu inscripción?</p>
                    <div className="pe-confirm-detalle">
                        <p className="pe-confirm-localidad">{evento.localidad}</p>
                        <p className="pe-confirm-fecha">
                            {formatearRangoFechas(evento.fecha_inicio, evento.fecha_fin)}
                            {evento.hora_inicio && (
                                <> · {formatearHora(evento.hora_inicio)}</>
                            )}
                        </p>
                        {evento.direccion && (
                            <p className="pe-confirm-dir">{evento.direccion}</p>
                        )}
                        {juegos.length > 0 && (
                            <div className="pe-tags" style={{ marginTop: '0.5rem' }}>
                                {juegos.map((j) => (
                                    <span key={j.id} className="pe-tag">{j.game_name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="pe-confirm-actions">
                        <button
                            className="main-button pe-confirm-btn-ok"
                            onClick={() => navigate(`/formulario/${evento.slug}`)}
                        >
                            Sí, inscribirme
                        </button>
                        <button
                            className="pe-confirm-btn-cancel"
                            onClick={() => setShowConfirm(false)}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export const ProximoEvento = ({ onLoadComplete }) => {
    const { proximosEventos, loading } = useProximosEventos();
    const eventIds = proximosEventos.map(e => e.id);
    const { eventGames } = useEventGames(eventIds);

    const [imagesLoaded, setImagesLoaded] = useState(0);
    const expectedImages = loading ? 0 : (proximosEventos.length || 1);

    const handleImageLoad = useCallback(() => {
        setImagesLoaded(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!loading && expectedImages > 0 && imagesLoaded >= expectedImages) {
            onLoadComplete?.();
        }
    }, [loading, imagesLoaded, expectedImages, onLoadComplete]);

    if (loading) {
        return (
            <section className="proximo-evento">
                <p className="pe-loading">Cargando eventos...</p>
            </section>
        );
    }

    if (!proximosEventos.length) {
        return (
            <section className="proximo-evento">
                <h2 className="pe-titulo">Próximos eventos</h2>
                <div className="pe-card">
                    <div className="pe-imagen-wrap">
                        <img
                            src={heroImg}
                            alt="LC e-SPORTS"
                            className="pe-imagen"
                            onLoad={handleImageLoad}
                            onError={handleImageLoad}
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
            <h2 className="pe-titulo">Próximos eventos</h2>

            {proximosEventos.map((evento) => (
                <EventoCard
                    key={evento.id}
                    evento={evento}
                    juegos={eventGames[evento.id] ?? []}
                    onImageLoad={handleImageLoad}
                />
            ))}
        </section>
    );
};

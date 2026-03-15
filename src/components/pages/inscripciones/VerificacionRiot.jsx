import { useState, useEffect } from "react";
import { useBackHandler } from "../../../context/BackHandlerContext";
import { useEventoSeleccionado } from "./hooks/useEventoSeleccionado";
import { getGameConfig } from "../../../data/gameConfig";
import { formatearHora } from "../../../utils/dateUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt, faLock } from "@fortawesome/free-solid-svg-icons";

import "@styles/FormularioDatos.css";
import "@styles/VerificacionCuenta.css";

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    return `${DIAS_CORTOS[fecha.getDay()]} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

// Título dinámico según juegos elegidos
const getTituloRiot = (juegos) => {
    const tieneLoL = juegos.some(g => ['LoL', 'League of Legends'].includes(g.game_name));
    const tieneVal = juegos.some(g => g.game_name === 'Valorant');
    if (tieneLoL && tieneVal) return 'LoL y Valorant — Tu cuenta de Riot';
    if (tieneLoL) return 'LoL — Tu cuenta de Riot';
    return 'Valorant — Tu cuenta de Riot';
};

// Banner slug: si tiene LoL (con o sin Valorant), usa lol; si solo Valorant, usa valorant
const getBannerSlug = (juegos) => {
    const tieneLoL = juegos.some(g => ['LoL', 'League of Legends'].includes(g.game_name));
    return tieneLoL ? 'lol' : 'valorant';
};

const getBannerColor = (slug) =>
    slug === 'lol' ? '#C8AA6E' : '#FF4655';

export const VerificacionRiot = ({ onBack, onNext, eventoId, juegosSeleccionados }) => {
    const { setBackHandler } = useBackHandler();
    useEffect(() => {
        setBackHandler(() => onBack);
        return () => setBackHandler(null);
    }, [onBack]);

    const { eventoSeleccionado } = useEventoSeleccionado(eventoId);
    const [riotId, setRiotId] = useState('');
    const [imgError, setImgError] = useState(false);

    const needsSteam = juegosSeleccionados.some(g => getGameConfig(g.game_name).verifyType === 'steam');
    const pasoActual = needsSteam ? 5 : 4;
    const totalPasos = 4 + (needsSteam ? 1 : 0) + 1; // base 4 + steam? + riot

    const progreso = Math.round((pasoActual / totalPasos) * 100);
    const stepBadges = [
        ...Array.from({ length: pasoActual - 1 }, (_, i) => i + 1),
        ...(totalPasos > pasoActual ? [totalPasos] : []),
    ];

    const titulo = getTituloRiot(juegosSeleccionados);
    const bannerSlug = getBannerSlug(juegosSeleccionados);
    const bannerColor = getBannerColor(bannerSlug);

    const fechaCorta = formatearFechaCorta(eventoSeleccionado?.fecha_inicio);
    const hora = formatearHora(eventoSeleccionado?.hora_inicio);

    return (
        <main className="vc-page">
            {/* Barra del evento */}
            <div className="fd-event-bar">
                <p className="fd-event-text">
                    {eventoSeleccionado?.localidad}
                    {fechaCorta && <> · {fechaCorta}</>}
                    {hora && <> · {hora}</>}
                </p>
                <button className="fd-event-link" onClick={onBack} type="button">
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    {' '}Ver detalles &gt;
                </button>
            </div>

            {/* Barra de progreso */}
            <div className="fd-progress-wrap">
                <div className="fd-progress-header">
                    <span className="fd-paso-text">Paso {pasoActual} de {totalPasos}</span>
                    <div className="fd-step-badges">
                        {stepBadges.map(n => (
                            <span
                                key={n}
                                className={`fd-step-badge${n < pasoActual ? ' fd-step-badge--done' : ''}`}
                            >
                                {n}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="fd-progress-bar">
                    <div className="fd-progress-fill" style={{ width: `${progreso}%` }} />
                </div>
            </div>

            {/* Título */}
            <h2 className="vc-titulo">{titulo}</h2>

            {/* Descripción */}
            <p className="vc-desc">
                Para jugar necesitás una cuenta de <strong>Riot</strong> activa.
                Si tenés tu Riot ID, ingresalo acá. Si no lo tenés a mano,
                podés completarlo después.
            </p>

            {/* Banner */}
            <div className="vc-banner">
                {!imgError ? (
                    <img
                        src={`/assets/img/games/${bannerSlug}-banner.jpg`}
                        alt={bannerSlug === 'lol' ? 'League of Legends' : 'Valorant'}
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="vc-banner-placeholder" style={{ backgroundColor: bannerColor }}>
                        {bannerSlug === 'lol' ? 'LoL' : 'Valorant'}
                    </div>
                )}
            </div>

            {/* Campo de usuario */}
            <div className="vc-field-group">
                <label className="fd-label">Riot ID (nombre#tag)</label>
                <input
                    className="fd-input"
                    type="text"
                    value={riotId}
                    onChange={e => setRiotId(e.target.value)}
                    placeholder="Tu Riot ID"
                    autoComplete="off"
                    autoCapitalize="none"
                />
            </div>

            {/* Nota de privacidad */}
            <p className="vc-privacy-note">
                <FontAwesomeIcon icon={faLock} />
                No pedimos contraseñas. Solo tu Riot ID.
            </p>

            {/* Footer */}
            <div className="vc-footer">
                <button
                    className="main-button vc-submit-btn"
                    type="button"
                    onClick={() => onNext(riotId.trim())}
                >
                    Siguiente
                </button>
                <span className="vc-completar-despues">Podés completarlo después</span>
            </div>
        </main>
    );
};

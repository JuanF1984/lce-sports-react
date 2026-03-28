import { useState, useEffect } from "react";
import { useBackHandler } from "../../../context/BackHandlerContext";
import { useEventoSeleccionado } from "./hooks/useEventoSeleccionado";
import { getGameConfig } from "../../../data/gameConfig";
import { formatearHora } from "../../../utils/dateUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt, faLock } from "@fortawesome/free-solid-svg-icons";
import { EventoModal } from "./common/EventoModal";

import "@styles/FormularioDatos.css";
import "@styles/VerificacionCuenta.css";

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    return `${DIAS_CORTOS[fecha.getDay()]} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

export const VerificacionSteam = ({ onBack, onNext, eventoId, juegosSeleccionados }) => {
    const { setBackHandler } = useBackHandler();
    useEffect(() => {
        setBackHandler(() => onBack);
        return () => setBackHandler(null);
    }, [onBack]);

    const { eventoSeleccionado } = useEventoSeleccionado(eventoId);
    const [steamUsername, setSteamUsername] = useState('');
    const [imgError, setImgError] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const needsRiot = juegosSeleccionados.some(g => getGameConfig(g.game_name).verifyType === 'riot');
    const pasoActual = 4;
    const totalPasos = 4 + 1 + (needsRiot ? 1 : 0); // base 4 + steam + riot?

    const progreso = Math.round((pasoActual / totalPasos) * 100);
    const stepBadges = [
        ...Array.from({ length: pasoActual - 1 }, (_, i) => i + 1),
        ...(totalPasos > pasoActual ? [totalPasos] : []),
    ];

    const fechaCorta = formatearFechaCorta(eventoSeleccionado?.fecha_inicio);
    const hora = formatearHora(eventoSeleccionado?.hora_inicio);

    return (
        <main className="vc-page">
            {showModal && <EventoModal evento={eventoSeleccionado} onClose={() => setShowModal(false)} />}

            {/* Barra del evento */}
            <div className="fd-event-bar">
                <p className="fd-event-text">
                    {eventoSeleccionado?.localidad}
                    {fechaCorta && <> · {fechaCorta}</>}
                    {hora && <> · {hora}</>}
                </p>
                <button className="fd-event-link" onClick={() => setShowModal(true)} type="button">
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
            <h2 className="vc-titulo">CS2 — Tu cuenta de Steam</h2>

            {/* Descripción */}
            <p className="vc-desc">
                Para jugar CS2 necesitás una <strong>cuenta de Steam</strong> activa.
                Si tenés tu nombre de usuario, ingresalo acá. Si no lo tenés a mano,
                podés completarlo después.
            </p>

            {/* Banner CS2 */}
            <div className="vc-banner">
                {!imgError ? (
                    <img
                        src="/assets/img/games/steam-card.webp"
                        alt="Steam"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="vc-banner-placeholder" style={{ backgroundColor: '#DE9B35' }}>
                        CS2
                    </div>
                )}
            </div>

            {/* Campo de usuario */}
            <div className="vc-field-group">
                <label className="fd-label">Nombre de usuario de Steam</label>
                <input
                    className="fd-input"
                    type="text"
                    value={steamUsername}
                    onChange={e => setSteamUsername(e.target.value)}
                    placeholder="Tu usuario de Steam"
                    autoComplete="off"
                    autoCapitalize="none"
                />
            </div>

            {/* Nota de privacidad */}
            <p className="vc-privacy-note">
                <FontAwesomeIcon icon={faLock} />
                No pedimos contraseñas. Solo tu nombre de usuario.
            </p>

            {/* Footer */}
            <div className="vc-footer">
                <button
                    className="main-button vc-submit-btn"
                    type="button"
                    onClick={() => onNext(steamUsername.trim())}
                >
                    Siguiente
                </button>
                <span className="vc-completar-despues">Podés completarlo después</span>
            </div>
        </main>
    );
};

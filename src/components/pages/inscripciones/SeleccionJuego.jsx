import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useBackHandler } from "../../../context/BackHandlerContext";
import { faCalendarAlt } from "@fortawesome/free-solid-svg-icons";

import { formatearHora } from "../../../utils/dateUtils";
import { getGameConfig } from "../../../data/gameConfig";
import { EventoModal } from "./common/EventoModal";

import "@styles/SeleccionJuego.css";

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGO  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    return `${DIAS_CORTOS[fecha.getDay()]} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

const getDiaSemana = (fechaStr, largo = false) => {
    const [y, m, d] = fechaStr.split('-').map(Number);
    const idx = new Date(y, m - 1, d).getDay();
    return largo ? DIAS_LARGO[idx] : DIAS_CORTOS[idx];
};

const formatearBadgeDias = (dias) => {
    if (dias.length === 1) return `Solo ${getDiaSemana(dias[0], true)}`;
    const nombres = dias.map(d => getDiaSemana(d));
    if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
};

const GameCard = ({ game, isSelected, onToggle, isMultiDay, selectedOrder, isMultiSelect }) => {
    const [imgError, setImgError] = useState(false);
    const config = getGameConfig(game.game_name);
    const isCompleto = game.cupos === 0;
    const isUltimosCupos = game.cupos != null && game.cupos > 0 && game.cupos <= 5;

    return (
        <button
            className={`sj-card${isSelected ? ' sj-card--selected' : ''}${isCompleto ? ' sj-card--completo' : ''}`}
            onClick={() => !isCompleto && onToggle(game)}
            disabled={isCompleto}
            type="button"
        >
            <div className="sj-card-img">
                {!imgError ? (
                    <img
                        src={`/assets/img/games/${config.slug}-card.webp`}
                        alt={game.game_name}
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div
                        className="sj-card-placeholder"
                        style={{ backgroundColor: config.color }}
                    />
                )}

                <div className="sj-card-overlay">
                    <span className="sj-card-name">{game.game_name}</span>
                </div>

                {/* Badge de días específicos */}
                {isMultiDay && game.dias?.length > 0 && (
                    <div className="sj-badge-dias">
                        <FontAwesomeIcon icon={faCalendarAlt} className="sj-badge-dias-icon" />
                        {formatearBadgeDias(game.dias)}
                    </div>
                )}

                {isUltimosCupos && !isSelected && (
                    <div className="sj-badge sj-badge--warn">Últimos<br />cupos</div>
                )}

                {isCompleto && (
                    <div className="sj-badge sj-badge--completo">Completo</div>
                )}

                {isSelected && isMultiSelect && selectedOrder && (
                    <div className={`sj-priority-badge sj-priority-badge--${Math.min(selectedOrder, 3)}`}>
                        {selectedOrder}
                    </div>
                )}
            </div>

            {!isCompleto ? (
                game.cupos != null
                    ? <p className="sj-card-cupos">Quedan {game.cupos}</p>
                    : null
            ) : (
                <p className="sj-card-espera">Sumarme a lista de espera</p>
            )}

            {isSelected && (
                <div className="sj-card-selected-bar sj-card-selected-bar--1">
                    {isMultiSelect ? `Opción ${selectedOrder}` : 'Seleccionado'}
                </div>
            )}
        </button>
    );
};

export const SeleccionJuego = ({ onBack, onNext, eventoSeleccionado, games }) => {
    const { setBackHandler } = useBackHandler();

    const [subStep, setSubStep] = useState('principal'); // 'principal' | 'secundario'
    const [showInfoModal, setShowInfoModal] = useState(true);
    const [showSecundarioModal, setShowSecundarioModal] = useState(false);
    const [showEventoModal, setShowEventoModal] = useState(false);
    const [juegoSeleccionado, setJuegoSeleccionado] = useState(null);
    const [juegosSecundarios, setJuegosSecundarios] = useState([]);

    useEffect(() => {
        if (subStep === 'principal') {
            setBackHandler(() => onBack);
        } else {
            setBackHandler(() => () => {
                setSubStep('principal');
                setJuegosSecundarios([]);
            });
        }
        return () => setBackHandler(null);
    }, [subStep, onBack]);

    const juegosPrincipales = games.filter(g => g.principal === true);
    const juegosSecundariosDisponibles = games.filter(g => g.principal === false && g.id !== juegoSeleccionado?.id);

    // Máximo de juegos secundarios: 1 si hay principal, 3 si no hay
    const maxSecundarios = juegoSeleccionado ? 1 : 3;

    // Hay juegos secundarios disponibles en este set (ya filtrado por team_option si es equipo)
    const hayJuegosSecundarios = games.some(g => g.principal === false);

    // Paso 2 siempre. Totales dinámicos según verificaciones necesarias.
    const pasoActual = 2;
    const needsSteam = juegoSeleccionado ? getGameConfig(juegoSeleccionado.game_name).verifyType === 'steam' : false;
    const needsRiot  = juegoSeleccionado ? getGameConfig(juegoSeleccionado.game_name).verifyType === 'riot'  : false;
    const totalPasos = 4 + (needsSteam ? 1 : 0) + (needsRiot ? 1 : 0);
    const progreso = Math.round((pasoActual / totalPasos) * 100);

    const stepBadges = [
        ...Array.from({ length: pasoActual - 1 }, (_, i) => i + 1),
        ...(totalPasos > pasoActual ? [totalPasos] : []),
    ];

    const fechaCorta = formatearFechaCorta(eventoSeleccionado?.fecha_inicio);
    const hora = formatearHora(eventoSeleccionado?.hora_inicio);

    // Evento de más de un día → habilita badge de días en las cards
    const isMultiDay = Boolean(
        eventoSeleccionado?.fecha_fin &&
        eventoSeleccionado.fecha_fin !== eventoSeleccionado.fecha_inicio
    );

    const togglePrincipal = (game) =>
        setJuegoSeleccionado(prev => prev?.id === game.id ? null : game);

    const toggleSecundario = (game) => {
        setJuegosSecundarios(prev => {
            const idx = prev.findIndex(g => g.id === game.id);
            if (idx !== -1) return prev.filter(g => g.id !== game.id);
            if (prev.length < maxSecundarios) return [...prev, game];
            return prev;
        });
    };

    const handleSiguientePrincipal = () => {
        if (hayJuegosSecundarios) {
            setShowSecundarioModal(true);
        } else {
            onNext([juegoSeleccionado]);
        }
    };

    const handleElegirSecundario = () => {
        setShowSecundarioModal(false);
        setSubStep('secundario');
    };

    const handleSinSecundario = () => {
        setShowSecundarioModal(false);
        onNext([juegoSeleccionado]);
    };

    const handleSaltarPrincipal = () => {
        setJuegosSecundarios([]);
        setSubStep('secundario');
    };

    const handleSiguienteSecundario = () => {
        const juegos = juegoSeleccionado ? [juegoSeleccionado, ...juegosSecundarios] : [...juegosSecundarios];
        onNext(juegos);
    };

    return (
        <main className="sj-page">
            {showEventoModal && (
                <EventoModal evento={eventoSeleccionado} onClose={() => setShowEventoModal(false)} />
            )}

            {/* Barra de info del evento */}
            <div className="sj-event-bar">
                <p className="sj-event-text">
                    {eventoSeleccionado?.localidad}
                    {fechaCorta && <> · {fechaCorta}</>}
                    {hora && <> · {hora}</>}
                </p>
                <button className="sj-event-link" onClick={() => setShowEventoModal(true)} type="button">
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    {' '}Ver detalles &gt;
                </button>
            </div>

            {/* Progreso */}
            <div className="sj-progress-wrap">
                <div className="sj-progress-header">
                    <span className="sj-paso-text">Paso {pasoActual} de {totalPasos}</span>
                    <div className="sj-step-badges">
                        {stepBadges.map(n => (
                            <span
                                key={n}
                                className={`sj-step-badge${n < pasoActual ? ' sj-step-badge--done' : ''}`}
                            >
                                {n}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="sj-progress-bar">
                    <div className="sj-progress-fill" style={{ width: `${progreso}%` }} />
                </div>
            </div>

            {/* ── Sub-pantalla: juegos principales ── */}
            {subStep === 'principal' && (
                <>
                    <h2 className="sj-titulo">Elegí tu juego</h2>
                    <p className="sj-subtitulo">Seleccioná el juego principal en el que querés participar.</p>

                    <div className="sj-cards-grid">
                        {juegosPrincipales.map(game => (
                            <GameCard
                                key={game.id}
                                game={game}
                                isSelected={juegoSeleccionado?.id === game.id}
                                onToggle={togglePrincipal}
                                isMultiDay={isMultiDay}
                            />
                        ))}
                    </div>

                    {juegoSeleccionado && (
                        <div className="sj-resumen">
                            <p className="sj-resumen-item">
                                <span className="sj-resumen-num sj-resumen-num--1">1</span>
                                <span className="sj-resumen-label">Juego principal:</span>
                                <strong>{juegoSeleccionado.game_name}</strong>
                            </p>
                        </div>
                    )}

                    <div className="sj-footer">
                        <button
                            className="main-button sj-btn"
                            type="button"
                            disabled={!juegoSeleccionado}
                            onClick={handleSiguientePrincipal}
                        >
                            Siguiente
                        </button>
                        {hayJuegosSecundarios && (
                            <button
                                className="sj-outline-btn sj-btn"
                                type="button"
                                onClick={handleSaltarPrincipal}
                            >
                                Ninguno de estos juegos
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* ── Sub-pantalla: juegos secundarios ── */}
            {subStep === 'secundario' && (
                <>
                    <h2 className="sj-titulo">
                        {juegoSeleccionado ? 'Juego secundario' : 'Elegí tus juegos'}
                    </h2>
                    <p className="sj-subtitulo">
                        {juegoSeleccionado
                            ? 'Elegí un juego secundario (opcional). El juego principal tendrá prioridad en la asignación de lugar.'
                            : `Podés inscribirte en hasta 3 juegos. Seleccionalos en orden de preferencia.`}
                    </p>

                    {!juegoSeleccionado && (
                        <p className="sj-secundario-counter">
                            {juegosSecundarios.length} / {maxSecundarios} seleccionados
                        </p>
                    )}

                    <div className="sj-cards-grid">
                        {juegosSecundariosDisponibles.map(game => {
                            const orderIdx = juegosSecundarios.findIndex(g => g.id === game.id);
                            const isSelected = orderIdx !== -1;
                            return (
                                <GameCard
                                    key={game.id}
                                    game={game}
                                    isSelected={isSelected}
                                    onToggle={toggleSecundario}
                                    isMultiDay={isMultiDay}
                                    selectedOrder={isSelected ? orderIdx + 1 : null}
                                    isMultiSelect={maxSecundarios > 1}
                                />
                            );
                        })}
                    </div>

                    {(juegoSeleccionado || juegosSecundarios.length > 0) && (
                        <div className="sj-resumen">
                            {juegoSeleccionado && (
                                <p className="sj-resumen-item">
                                    <span className="sj-resumen-num sj-resumen-num--1">1</span>
                                    <span className="sj-resumen-label">Principal:</span>
                                    <strong>{juegoSeleccionado.game_name}</strong>
                                </p>
                            )}
                            {juegosSecundarios.map((j, i) => (
                                <p key={j.id} className="sj-resumen-item">
                                    <span className={`sj-resumen-num sj-resumen-num--${juegoSeleccionado ? 2 : i + 1}`}>
                                        {juegoSeleccionado ? 2 : i + 1}
                                    </span>
                                    <span className="sj-resumen-label">
                                        {juegoSeleccionado ? 'Secundario:' : `Opción ${i + 1}:`}
                                    </span>
                                    <strong>{j.game_name}</strong>
                                </p>
                            ))}
                        </div>
                    )}

                    <div className="sj-footer">
                        <button
                            className="main-button sj-btn"
                            type="button"
                            disabled={juegosSecundarios.length === 0}
                            onClick={handleSiguienteSecundario}
                        >
                            Siguiente
                        </button>
                        {juegoSeleccionado && (
                            <button
                                className="sj-skip-btn"
                                type="button"
                                onClick={() => onNext([juegoSeleccionado])}
                            >
                                Continuar sin juego secundario
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* ── Modal informativo al inicio ── */}
            {showInfoModal && (
                <div className="sj-modal-overlay" onClick={() => setShowInfoModal(false)}>
                    <div className="sj-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="sj-modal-titulo">Selección de juegos</h3>
                        <p className="sj-modal-texto">
                            {hayJuegosSecundarios
                                ? 'Vas a poder elegir un juego principal. Si no elegís ninguno, podrás inscribirte en hasta 3 juegos en orden de preferencia.'
                                : 'Seleccioná el juego en el que querés participar.'}
                        </p>
                        <button
                            className="main-button sj-modal-btn"
                            type="button"
                            onClick={() => setShowInfoModal(false)}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* ── Modal de decisión: ¿juego secundario? ── */}
            {showSecundarioModal && (
                <div className="sj-modal-overlay">
                    <div className="sj-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="sj-modal-titulo">¿Querés elegir un juego secundario?</h3>
                        <p className="sj-modal-texto">
                            Podés inscribirte también en un juego secundario. Tené en cuenta que el juego principal tendrá prioridad en la asignación de lugar durante el torneo.
                        </p>
                        <div className="sj-modal-actions">
                            <button
                                className="main-button sj-modal-btn"
                                type="button"
                                onClick={handleElegirSecundario}
                            >
                                Sí, elegir juego secundario
                            </button>
                            <button
                                className="sj-modal-btn-secondary"
                                type="button"
                                onClick={handleSinSecundario}
                            >
                                No, continuar sin juego secundario
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

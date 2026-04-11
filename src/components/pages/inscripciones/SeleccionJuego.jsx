import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useBackHandler } from "../../../context/BackHandlerContext";
import { faCalendarAlt } from "@fortawesome/free-solid-svg-icons";

import { formatearHora } from "../../../utils/dateUtils";
import { getGameConfig } from "../../../data/gameConfig";
import { EventoModal } from "./common/EventoModal";

import "@styles/SeleccionJuego.css";

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    return `${DIAS_CORTOS[fecha.getDay()]} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

const GameCard = ({ game, priority, onToggle }) => {
    const [imgError, setImgError] = useState(false);
    const config = getGameConfig(game.game_name);
    const isSelected = priority !== null;
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

                {/* Nombre del juego sobre la imagen */}
                <div className="sj-card-overlay">
                    <span className="sj-card-name">{game.game_name}</span>
                </div>

                {/* Badge de prioridad (1 o 2) al seleccionar */}
                {isSelected && (
                    <div className={`sj-priority-badge sj-priority-badge--${priority}`}>
                        {priority}
                    </div>
                )}

                {/* Badge últimos cupos (solo si NO está seleccionado) */}
                {isUltimosCupos && !isSelected && (
                    <div className="sj-badge sj-badge--warn">Últimos<br />cupos</div>
                )}

                {/* Badge completo */}
                {isCompleto && (
                    <div className="sj-badge sj-badge--completo">Completo</div>
                )}
            </div>

            {/* Texto debajo de la imagen */}
            {!isCompleto ? (
                game.cupos != null
                    ? <p className="sj-card-cupos">Quedan {game.cupos}</p>
                    : null
            ) : (
                <p className="sj-card-espera">Sumarme a lista de espera</p>
            )}

            {/* Barra "Seleccionado" */}
            {isSelected && (
                <div className={`sj-card-selected-bar sj-card-selected-bar--${priority}`}>
                    {priority === 1 ? 'Principal' : 'Secundario'}
                </div>
            )}
        </button>
    );
};

export const SeleccionJuego = ({ onBack, onNext, eventoSeleccionado, games }) => {
    const { setBackHandler } = useBackHandler();
    useEffect(() => {
        setBackHandler(() => onBack);
        return () => setBackHandler(null);
    }, [onBack]);

    const [showModal, setShowModal] = useState(false);
    const [showLimiteModal, setShowLimiteModal] = useState(false);

    // Selección ordenada — máximo 2 juegos. El índice define la prioridad (0 → 1, 1 → 2).
    const [selectedGames, setSelectedGames] = useState([]);

    const toggleGame = (game) => {
        setSelectedGames(prev => {
            const yaEsta = prev.some(g => g.id === game.id);
            if (yaEsta) {
                // Deseleccionar y reordenar el resto
                return prev.filter(g => g.id !== game.id);
            }
            if (prev.length >= 2) {
                // Límite alcanzado — mostrar modal
                setShowLimiteModal(true);
                return prev;
            }
            return [...prev, game];
        });
    };

    // Paso 2 siempre. Total dinámico: 4 base + 1 si Steam + 1 si Riot.
    const pasoActual = 2;
    const needsSteam = selectedGames.some(g => getGameConfig(g.game_name).verifyType === 'steam');
    const needsRiot  = selectedGames.some(g => getGameConfig(g.game_name).verifyType === 'riot');
    const totalPasos = 4 + (needsSteam ? 1 : 0) + (needsRiot ? 1 : 0);
    const progreso = Math.round((pasoActual / totalPasos) * 100);

    // Badges: pasos completados (1..pasoActual-1) + último paso
    const stepBadges = [
        ...Array.from({ length: pasoActual - 1 }, (_, i) => i + 1),
        ...(totalPasos > pasoActual ? [totalPasos] : []),
    ];

    const fechaCorta = formatearFechaCorta(eventoSeleccionado?.fecha_inicio);
    const hora = formatearHora(eventoSeleccionado?.hora_inicio);

    return (
        <main className="sj-page">
            {showModal && <EventoModal evento={eventoSeleccionado} onClose={() => setShowModal(false)} />}

            {/* Barra de info del evento */}
            <div className="sj-event-bar">
                <p className="sj-event-text">
                    {eventoSeleccionado?.localidad}
                    {fechaCorta && <> · {fechaCorta}</>}
                    {hora && <> · {hora}</>}
                </p>
                <button className="sj-event-link" onClick={() => setShowModal(true)} type="button">
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

            {/* Título */}
            <h2 className="sj-titulo">Elegí tu juego</h2>
            <p className="sj-subtitulo">Podés inscribirte en hasta 2 juegos. El juego principal tendrá prioridad en la asignación de lugar durante el torneo.</p>

            {/* Grid de juegos */}
            <div className="sj-cards-grid">
                {games.map(game => {
                    const idx = selectedGames.findIndex(g => g.id === game.id);
                    const priority = idx === -1 ? null : idx + 1;
                    return (
                        <GameCard
                            key={game.id}
                            game={game}
                            priority={priority}
                            onToggle={toggleGame}
                        />
                    );
                })}
            </div>

            {/* Resumen de selección */}
            {selectedGames.length > 0 && (
                <div className="sj-resumen">
                    <p className="sj-resumen-item">
                        <span className="sj-resumen-num sj-resumen-num--1">1</span>
                        <span className="sj-resumen-label">Juego principal:</span>
                        <strong>{selectedGames[0].game_name}</strong>
                    </p>
                    {selectedGames[1] && (
                        <p className="sj-resumen-item">
                            <span className="sj-resumen-num sj-resumen-num--2">2</span>
                            <span className="sj-resumen-label">Juego secundario:</span>
                            <strong>{selectedGames[1].game_name}</strong>
                        </p>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="sj-footer">
                <button
                    className="main-button sj-btn"
                    type="button"
                    disabled={selectedGames.length === 0}
                    onClick={() => selectedGames.length > 0 && onNext(selectedGames)}
                >
                    Siguiente
                </button>
            </div>

            {/* Modal límite de juegos */}
            {showLimiteModal && (
                <div className="sj-modal-overlay" onClick={() => setShowLimiteModal(false)}>
                    <div className="sj-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="sj-modal-titulo">Límite de juegos alcanzado</h3>
                        <p className="sj-modal-texto">
                            Solo podés inscribirte en hasta 2 juegos por torneo. Si querés cambiar, deseleccioná uno de los juegos elegidos primero.
                        </p>
                        <button
                            className="main-button sj-modal-btn"
                            type="button"
                            onClick={() => setShowLimiteModal(false)}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
};

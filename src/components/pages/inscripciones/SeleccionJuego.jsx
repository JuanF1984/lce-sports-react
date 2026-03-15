import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useBackHandler } from "../../../context/BackHandlerContext";
import { faCalendarAlt, faCheck } from "@fortawesome/free-solid-svg-icons";

import { formatearHora } from "../../../utils/dateUtils";
import { getGameConfig } from "../../../data/gameConfig";

import "@styles/SeleccionJuego.css";

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    return `${DIAS_CORTOS[fecha.getDay()]} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

const GameCard = ({ game, isSelected, onToggle }) => {
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
                        src={`/assets/img/games/${config.slug}-card.jpg`}
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

                {/* Check verde al seleccionar */}
                {isSelected && (
                    <div className="sj-card-check">
                        <FontAwesomeIcon icon={faCheck} />
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
                <div className="sj-card-selected-bar">Seleccionado</div>
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

    // Selección múltiple — array de objetos game
    const [selectedGames, setSelectedGames] = useState([]);

    const toggleGame = (game) => {
        setSelectedGames(prev =>
            prev.some(g => g.id === game.id)
                ? prev.filter(g => g.id !== game.id)
                : [...prev, game]
        );
    };

    // Paso 3 siempre. Total: 5 si algún juego seleccionado requiere verificación, 4 si no.
    const pasoActual = 3;
    const requiresVerify = selectedGames.some(g => getGameConfig(g.game_name).requiresVerify);
    const totalPasos = requiresVerify ? 5 : 4;
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
            {/* Barra de info del evento */}
            <div className="sj-event-bar">
                <p className="sj-event-text">
                    {eventoSeleccionado?.localidad}
                    {fechaCorta && <> · {fechaCorta}</>}
                    {hora && <> · {hora}</>}
                </p>
                <button className="sj-event-link" onClick={onBack} type="button">
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
            <p className="sj-subtitulo">Podés anotarte en más de un juego</p>

            {/* Grid de juegos */}
            <div className="sj-cards-grid">
                {games.map(game => (
                    <GameCard
                        key={game.id}
                        game={game}
                        isSelected={selectedGames.some(g => g.id === game.id)}
                        onToggle={toggleGame}
                    />
                ))}
            </div>

            {/* Footer */}
            <div className="sj-footer">
                {selectedGames.length > 0 && (
                    <p className="sj-seleccionado-text">
                        Seleccionados: <strong>{selectedGames.map(g => g.game_name).join(', ')}</strong>
                    </p>
                )}
                <button
                    className="main-button sj-btn"
                    type="button"
                    disabled={selectedGames.length === 0}
                    onClick={() => selectedGames.length > 0 && onNext(selectedGames)}
                >
                    Siguiente
                </button>
            </div>
        </main>
    );
};

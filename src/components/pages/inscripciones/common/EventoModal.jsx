import { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faLocationDot, faCalendarDays, faClock } from "@fortawesome/free-solid-svg-icons";
import { formatearFecha, formatearHora } from "../../../../utils/dateUtils";
import "@styles/EventoModal.css";

export const EventoModal = ({ evento, onClose }) => {
    // Cerrar con Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    if (!evento) return null;

    const fechaInicio = formatearFecha(evento.fecha_inicio);
    const fechaFin   = evento.fecha_fin && evento.fecha_fin !== evento.fecha_inicio
        ? formatearFecha(evento.fecha_fin)
        : null;
    const hora = formatearHora(evento.hora_inicio);

    return (
        <div className="em-overlay" onClick={onClose}>
            <div className="em-card" onClick={e => e.stopPropagation()}>
                <button className="em-close" onClick={onClose} type="button" aria-label="Cerrar">
                    <FontAwesomeIcon icon={faXmark} />
                </button>

                <h3 className="em-titulo">Detalles del evento</h3>

                <ul className="em-lista">
                    <li>
                        <FontAwesomeIcon icon={faLocationDot} className="em-icon" />
                        <div>
                            <span className="em-label">Localidad</span>
                            <span className="em-valor">{evento.localidad}</span>
                        </div>
                    </li>

                    {evento.direccion && (
                        <li>
                            <FontAwesomeIcon icon={faLocationDot} className="em-icon em-icon--muted" />
                            <div>
                                <span className="em-label">Dirección</span>
                                <span className="em-valor">{evento.direccion}</span>
                            </div>
                        </li>
                    )}

                    <li>
                        <FontAwesomeIcon icon={faCalendarDays} className="em-icon" />
                        <div>
                            <span className="em-label">Fecha</span>
                            <span className="em-valor">
                                {fechaInicio}
                                {fechaFin && <> — {fechaFin}</>}
                            </span>
                        </div>
                    </li>

                    {hora && (
                        <li>
                            <FontAwesomeIcon icon={faClock} className="em-icon" />
                            <div>
                                <span className="em-label">Hora de inicio</span>
                                <span className="em-valor">{hora}</span>
                            </div>
                        </li>
                    )}
                </ul>

                <p className="em-gratuito">El evento es libre y gratuito</p>

                <button className="em-btn-cerrar main-button" onClick={onClose} type="button">
                    Cerrar
                </button>
            </div>
        </div>
    );
};

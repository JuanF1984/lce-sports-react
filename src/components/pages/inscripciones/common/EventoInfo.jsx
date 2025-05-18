// Componente para mostrar información del evento
import { formatearFecha, formatearHora } from "../../../../utils/dateUtils";

export const EventoInfo = ({ evento, loading }) => {
    if (loading) {
        return (
            <div className="info-text">
                <p>Cargando datos del evento...</p>
            </div>
        );
    }
    
    if (!evento) {
        return (
            <div className="info-text">
                <p>No se encontraron datos del evento.</p>
            </div>
        );
    }
    
    return (
        <div className="info-text">
            {evento.nombre && <h4>{evento.nombre}</h4>}
            <p>Fecha del torneo: {formatearFecha(evento.fecha_inicio)}</p>
            {evento.fecha_inicio !== evento.fecha_fin && (
                <p> al {formatearFecha(evento.fecha_fin)}</p>
            )}
            <p>Hora de inicio: {formatearHora(evento.hora_inicio)}</p>
            <p>Lugar: {evento.localidad}</p>
            <p>El evento es libre y gratuito</p>
        </div>
    );
};
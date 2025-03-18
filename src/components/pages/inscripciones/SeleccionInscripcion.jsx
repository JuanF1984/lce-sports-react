import { useState } from "react";
import { Formulario } from "./Formulario";
import { FormularioEquipo } from "./FormularioEquipo";
import { useProximoEvento } from "../../../hooks/useProximoEvento";
import { useEventGames } from "../../../hooks/useEventGames";
import { LogoNeon } from "../../common/LogoNeon";

export const SeleccionInscripcion = () => {
    const [tipoInscripcion, setTipoInscripcion] = useState(null);
    const { proximoEvento, loading: loadingEvento } = useProximoEvento();
    const { eventGames, loading: loadingGames } = useEventGames(proximoEvento ? [proximoEvento.id] : []);
    
    // Verificar si hay juegos que permiten equipos
    const hayJuegosEquipo = proximoEvento?.id
        ? (eventGames[proximoEvento.id] || []).some(game => game.team_option)
        : false;
    
    if (loadingEvento || loadingGames) {
        return <LogoNeon />;
    }
    
    if (tipoInscripcion === "individual") {
        // Pasar el formulario individual sin modificaciones
        return <Formulario onBack={() => setTipoInscripcion(null)} />;
    }
    
    if (tipoInscripcion === "equipo") {
        return <FormularioEquipo onBack={() => setTipoInscripcion(null)} />;
    }
    
    return (
        <main>
            <div className="form-container">
                <h3>Inscripción al Torneo</h3>
                <div className="info-text">
                    <p>Selecciona el tipo de inscripción que deseas realizar:</p>
                </div>
                <button
                    className='main-button'
                    onClick={() => setTipoInscripcion("individual")}
                >
                    Individual
                </button>
                
                {/* Mostrar el botón de equipo solo si hay juegos de equipo, sin importar si está autenticado */}
                {hayJuegosEquipo && (
                    <button
                        className='main-button'
                        onClick={() => setTipoInscripcion("equipo")}
                    >
                        Equipo
                    </button>
                )}
            </div>
        </main>
    );
};
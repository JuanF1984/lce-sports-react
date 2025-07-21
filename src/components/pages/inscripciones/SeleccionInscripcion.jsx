import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Formulario } from "./Formulario";
import { FormularioEquipo } from "./FormularioEquipo";
import { useEventGames } from "../../../hooks/useEventGames";
import { LogoNeon } from "../../common/LogoNeon";
import supabase from "../../../utils/supabase";
import { formatearFecha, formatearHora } from "../../../utils/dateUtils";

export const SeleccionInscripcion = () => {
    const { eventoSlug } = useParams();
    const [tipoInscripcion, setTipoInscripcion] = useState(null);
    const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchEventoSeleccionado = async () => {


            if (eventoSlug) {
                try {
                    const { data, error } = await supabase
                        .from('events')
                        .select('*')
                        .eq('slug', eventoSlug)
                        .single();

                    if (error || !data) {

                        navigate('/');
                        return;
                    }


                    setEventoSeleccionado(data);
                } catch (err) {

                    navigate('/');
                } finally {

                    setLoading(false);
                }
                return;
            }

            navigate('/');
        };

        fetchEventoSeleccionado();
    }, [eventoSlug, navigate]);

    // Cargar los juegos del evento seleccionado
    const { eventGames, loading: loadingGames } = useEventGames(
        eventoSeleccionado ? [eventoSeleccionado.id] : []
    );

    // Verificar si hay juegos que permiten equipos
    const hayJuegosEquipo = eventoSeleccionado?.id
        ? (eventGames[eventoSeleccionado.id] || []).some(game => game.team_option)
        : false;

    if (loading || loadingGames) {
        return <LogoNeon />;
    }

    if (tipoInscripcion === "individual") {
        // Pasar el ID del evento al formulario individual
        return <Formulario
            onBack={() => setTipoInscripcion(null)}
            eventoId={eventoSeleccionado.id}
        />;
    }



    if (tipoInscripcion === "equipo") {
        // Pasar el ID del evento al formulario de equipo
        return <FormularioEquipo
            onBack={() => setTipoInscripcion(null)}
            eventoId={eventoSeleccionado.id}
        />;
    }


    return (
        <main>
            <div className="form-container">
                <h3>Inscripción al Torneo</h3>
                <div className="info-text">
                    <h4>{eventoSeleccionado.localidad}</h4>
                    <p>Dirección: {eventoSeleccionado.direccion}</p>
                    <p>Fecha: {formatearFecha(eventoSeleccionado.fecha_inicio)}</p>
                    {eventoSeleccionado.hora_inicio && (
                        <p>Hora: {formatearHora(eventoSeleccionado.hora_inicio)}</p>
                    )}
                </div>
                <div className="info-text">
                    <p>Selecciona el tipo de inscripción que deseas realizar:</p>
                </div>
                <button
                    className='main-button'
                    onClick={() => setTipoInscripcion("individual")}
                >
                    Individual
                </button>

                {/* Mostrar el botón de equipo solo si hay juegos de equipo */}
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
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faUsers, faCalendarAlt } from "@fortawesome/free-solid-svg-icons";

import { Formulario } from "./Formulario";
import { FormularioEquipo } from "./FormularioEquipo";
import { SeleccionJuego } from "./SeleccionJuego";
import { VerificacionSteam } from "./VerificacionSteam";
import { VerificacionRiot } from "./VerificacionRiot";
import { Confirmacion } from "./Confirmacion";
import { ConfirmacionEquipo } from "./ConfirmacionEquipo";
import { EventoModal } from "./common/EventoModal";
import { getGameConfig } from "../../../data/gameConfig";
import { useEventGames } from "../../../hooks/useEventGames";
import { LogoNeon } from "../../common/LogoNeon";
import supabase from "../../../utils/supabase";
import { formatearHora } from "../../../utils/dateUtils";
import { tituloEventoCorto } from "../../../utils/eventoDisplay";
import { permiteIndividual, permiteEquipo } from "../../../utils/registrationMode";

import "@styles/SeleccionInscripcion.css";

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    return `${DIAS_CORTOS[fecha.getDay()]} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

export const SeleccionInscripcion = () => {
    const { eventoSlug } = useParams();
    const [tipoInscripcion, setTipoInscripcion] = useState(null); // "individual" | "equipo"
    const [paso, setPaso] = useState('tipo'); // 'tipo' | 'juego' | 'datos' | 'steam' | 'riot' | 'confirmacion'
    const [juegosSeleccionados, setJuegosSeleccionados] = useState([]);
    const [formData, setFormData] = useState(null);
    const [equipoFormData, setEquipoFormData] = useState(null);
    const [steamUsername, setSteamUsername] = useState('');
    const [riotId, setRiotId] = useState('');
    const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModalEvento, setShowModalEvento] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [paso]);

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
                        // Se deja registrado el motivo real (RLS, slug duplicado, etc.)
                        // en vez de perderlo silenciosamente al volver a '/'.
                        console.error('No se pudo cargar el evento por slug:', eventoSlug, error);
                        navigate('/');
                        return;
                    }

                    setEventoSeleccionado(data);

                    // Para presentaciones: saltar pasos de tipo/juego, ir directo a datos
                    if (data.tipo === 'presentacion') {
                        setTipoInscripcion('individual');
                        setPaso('datos');
                    }
                } catch (err) {
                    console.error('Error inesperado al cargar el evento por slug:', eventoSlug, err);
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

    const { eventGames, loading: loadingGames } = useEventGames(
        eventoSeleccionado ? [eventoSeleccionado.id] : []
    );

    const games = eventoSeleccionado?.id ? (eventGames[eventoSeleccionado.id] || []) : [];

    // La modalidad (individual/equipo/ambas) es por juego dentro del evento
    // (event_games.registration_mode), no global al juego — ver src/utils/registrationMode.js.
    const hayJuegosEquipo = games.some(permiteEquipo);
    const hayJuegosIndividual = games.some(permiteIndividual);

    // useEventGames() arranca con su propio `loading` en `false` y recién lo
    // pone en `true` dentro de su useEffect — un render después de que
    // `eventoSeleccionado` pasa de null a un evento real. Sin este flag, ese
    // render intermedio (loadingGames todavía false, games todavía []) deja
    // pasar el gate de abajo y pinta el paso "tipo" sin botones
    // Individual/Equipo durante un frame, antes de que loadingGames se ponga
    // en true y vuelva a tapar todo con el spinner. juegosListos arranca en
    // false y solo pasa a true cuando useEventGames ya terminó (con o sin
    // resultados) para el evento actual, así que ese render intermedio queda
    // cubierto igual que el resto.
    const [juegosListos, setJuegosListos] = useState(false);
    useEffect(() => {
        if (eventoSeleccionado?.id && !loadingGames) {
            setJuegosListos(true);
        }
    }, [eventoSeleccionado?.id, loadingGames]);

    if (loading || loadingGames || (eventoSeleccionado?.id && !juegosListos)) {
        return <LogoNeon />;
    }

    // El evento no pudo cargarse (slug inexistente/duplicado, error de Supabase, etc.).
    // El efecto de carga ya disparó navigate('/') y registró el error real en consola;
    // acá solo evitamos renderizar accediendo a propiedades de null mientras se completa
    // esa navegación.
    if (!eventoSeleccionado) {
        return null;
    }

    const esPresentacion = eventoSeleccionado?.tipo === 'presentacion';

    // Cierre: evento pasado, inscripciones cerradas por admin, o fecha_cierre_inscripcion ya pasó
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaFinEvento = eventoSeleccionado?.fecha_fin
        ? (() => { const [y,m,d] = eventoSeleccionado.fecha_fin.split('-').map(Number); return new Date(y, m-1, d); })()
        : (() => { const [y,m,d] = eventoSeleccionado.fecha_inicio.split('-').map(Number); return new Date(y, m-1, d); })();
    const eventoVencido = fechaFinEvento < hoy;

    const fechaCierre = eventoSeleccionado?.fecha_cierre_inscripcion;
    const cerradoPorFecha = fechaCierre && new Date() > new Date(fechaCierre);
    const sinCupos = eventoSeleccionado?.inscripciones_abiertas === false || cerradoPorFecha;

    if (eventoVencido || sinCupos) {
        const mensajeTitulo = eventoVencido
            ? 'Este evento ya finalizó'
            : esPresentacion
                ? 'Inscripción cerrada'
                : 'No quedan más cupos';
        const mensajeSub = eventoVencido
            ? 'Las inscripciones para este evento están cerradas.'
            : esPresentacion
                ? 'Las inscripciones para esta presentación están cerradas.'
                : 'Los cupos para este evento se han agotado. Seguinos en redes para enterarte de los próximos eventos.';

        return (
            <main className="si-page">
                <div className="si-event-bar">
                    <p className="si-event-text">{tituloEventoCorto(eventoSeleccionado)}</p>
                </div>
                <div className="si-cerrado">
                    <div className="si-cerrado-icon">{sinCupos && !eventoVencido ? '🎮' : '📅'}</div>
                    <h2 className="si-cerrado-titulo">{mensajeTitulo}</h2>
                    <p className="si-cerrado-sub">{mensajeSub}</p>
                </div>
            </main>
        );
    }

    const siguientePasoTrasDatos = (juegos) => {
        const needsSteam = juegos.some(g => getGameConfig(g.game_name).verifyType === 'steam');
        const needsRiot  = juegos.some(g => getGameConfig(g.game_name).verifyType === 'riot');
        if (needsSteam) return 'steam';
        if (needsRiot)  return 'riot';
        return 'confirmacion';
    };

    const siguientePasoTrasSteam = (juegos) => {
        const needsRiot = juegos.some(g => getGameConfig(g.game_name).verifyType === 'riot');
        return needsRiot ? 'riot' : 'confirmacion';
    };

    // ── Paso: selección de juego (solo torneos) ─────────
    if (paso === 'juego') {
        const gamesDisponibles = tipoInscripcion === 'equipo'
            ? games.filter(permiteEquipo)
            : games.filter(permiteIndividual);
        return (
            <SeleccionJuego
                onBack={() => { setPaso('tipo'); setTipoInscripcion(null); }}
                onNext={(games) => { setJuegosSeleccionados(games); setPaso('datos'); }}
                eventoSeleccionado={eventoSeleccionado}
                games={gamesDisponibles}
            />
        );
    }

    // ── Paso: formulario de datos ───────────────────────
    if (paso === 'datos') {
        if (tipoInscripcion === 'individual') {
            return (
                <Formulario
                    onBack={esPresentacion
                        ? () => navigate('/')
                        : () => setPaso('juego')}
                    onNext={(data) => {
                        setFormData(data);
                        setPaso(esPresentacion ? 'confirmacion' : siguientePasoTrasDatos(juegosSeleccionados));
                    }}
                    eventoId={eventoSeleccionado.id}
                    juegosSeleccionados={juegosSeleccionados}
                />
            );
        }
        if (tipoInscripcion === 'equipo') {
            return (
                <FormularioEquipo
                    onBack={() => setPaso('juego')}
                    onNext={(data) => {
                        setEquipoFormData(data);
                        setPaso(siguientePasoTrasDatos(juegosSeleccionados));
                    }}
                    eventoId={eventoSeleccionado.id}
                    juegosSeleccionados={juegosSeleccionados}
                />
            );
        }
    }

    // ── Paso: verificación Steam ────────────────────────
    if (paso === 'steam') {
        return (
            <VerificacionSteam
                onBack={() => setPaso('datos')}
                onNext={(username) => {
                    setSteamUsername(username);
                    setPaso(siguientePasoTrasSteam(juegosSeleccionados));
                }}
                eventoId={eventoSeleccionado.id}
                juegosSeleccionados={juegosSeleccionados}
            />
        );
    }

    // ── Paso: verificación Riot ─────────────────────────
    if (paso === 'riot') {
        const needsSteam = juegosSeleccionados.some(g => getGameConfig(g.game_name).verifyType === 'steam');
        return (
            <VerificacionRiot
                onBack={() => setPaso(needsSteam ? 'steam' : 'datos')}
                onNext={(riot) => {
                    setRiotId(riot);
                    setPaso('confirmacion');
                }}
                eventoId={eventoSeleccionado.id}
                juegosSeleccionados={juegosSeleccionados}
            />
        );
    }

    // ── Paso: confirmación ──────────────────────────────
    if (paso === 'confirmacion') {
        if (tipoInscripcion === 'equipo') {
            return (
                <ConfirmacionEquipo
                    eventoId={eventoSeleccionado.id}
                    eventoSeleccionado={eventoSeleccionado}
                    equipoFormData={equipoFormData}
                    juegosSeleccionados={juegosSeleccionados}
                    steamUsername={steamUsername}
                    riotId={riotId}
                />
            );
        }
        return (
            <Confirmacion
                eventoId={eventoSeleccionado.id}
                eventoSeleccionado={eventoSeleccionado}
                formData={formData}
                juegosSeleccionados={juegosSeleccionados}
                steamUsername={steamUsername}
                riotId={riotId}
            />
        );
    }

    // ── Paso: tipo de inscripción (solo torneos) ────────
    const fechaCorta = formatearFechaCorta(eventoSeleccionado.fecha_inicio);
    const hora = formatearHora(eventoSeleccionado.hora_inicio);

    return (
        <main className="si-page">
            {showModalEvento && <EventoModal evento={eventoSeleccionado} onClose={() => setShowModalEvento(false)} />}

            <div className="si-event-bar">
                <p className="si-event-text">
                    {tituloEventoCorto(eventoSeleccionado)}
                    {fechaCorta && <> · {fechaCorta}</>}
                    {hora && <> · {hora}</>}
                </p>
                <button
                    className="si-event-link"
                    onClick={() => setShowModalEvento(true)}
                >
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    {' '}Ver detalles &gt;
                </button>
            </div>

            <h2 className="si-titulo">¿Cómo te anotás?</h2>

            <div className="si-cards-grid">
                {hayJuegosIndividual && (
                    <button
                        className="si-card"
                        onClick={() => { setTipoInscripcion('individual'); setPaso('juego'); }}
                    >
                        <div className="si-card-icon">
                            <FontAwesomeIcon icon={faUser} />
                        </div>
                        <p className="si-card-title">Individual</p>
                        <p className="si-card-sub">Para inscribirte solo</p>
                        <span className="si-card-arrow">›</span>
                    </button>
                )}

                {hayJuegosEquipo && (
                    <button
                        className="si-card"
                        onClick={() => { setTipoInscripcion('equipo'); setPaso('juego'); }}
                    >
                        <div className="si-card-icon">
                            <FontAwesomeIcon icon={faUsers} />
                        </div>
                        <p className="si-card-title">Equipo</p>
                        <p className="si-card-sub">Para inscribir a tu equipo</p>
                        <span className="si-card-arrow">›</span>
                    </button>
                )}
            </div>
        </main>
    );
};

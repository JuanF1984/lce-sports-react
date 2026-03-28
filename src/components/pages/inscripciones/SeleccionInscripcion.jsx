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
import { getGameConfig } from "../../../data/gameConfig";
import { useEventGames } from "../../../hooks/useEventGames";
import { LogoNeon } from "../../common/LogoNeon";
import supabase from "../../../utils/supabase";
import { formatearHora } from "../../../utils/dateUtils";

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

    const { eventGames, loading: loadingGames } = useEventGames(
        eventoSeleccionado ? [eventoSeleccionado.id] : []
    );

    const games = eventoSeleccionado?.id ? (eventGames[eventoSeleccionado.id] || []) : [];

    const hayJuegosEquipo = games.some(game => game.team_option);

    if (loading || loadingGames) {
        return <LogoNeon />;
    }

    // Helper: calcula el siguiente paso tras el formulario de datos
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

    // ── Paso: selección de juego ────────────────────────
    if (paso === 'juego') {
        const gamesDisponibles = tipoInscripcion === 'equipo'
            ? games.filter(g => g.team_option)
            : games;
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
                    onBack={() => setPaso('juego')}
                    onNext={(data) => {
                        setFormData(data);
                        setPaso(siguientePasoTrasDatos(juegosSeleccionados));
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

    // ── Paso: tipo de inscripción (default) ─────────────
    const fechaCorta = formatearFechaCorta(eventoSeleccionado.fecha_inicio);
    const hora = formatearHora(eventoSeleccionado.hora_inicio);

    return (
        <main className="si-page">
            {/* Barra de info del evento */}
            <div className="si-event-bar">
                <p className="si-event-text">
                    {eventoSeleccionado.localidad}
                    {fechaCorta && <> · {fechaCorta}</>}
                    {hora && <> · {hora}</>}
                </p>
                <button
                    className="si-event-link"
                    onClick={() => navigate('/')}
                >
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    {' '}Ver detalles &gt;
                </button>
            </div>

            {/* Título */}
            <h2 className="si-titulo">¿Cómo te anotás?</h2>

            {/* Grid de cards */}
            <div className="si-cards-grid">
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

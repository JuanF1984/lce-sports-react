import { useState, useEffect } from "react";
import supabase from "../../../utils/supabase";
import { generateQRString } from "../../../utils/qrCodeGenerator";
import { enviarConfirmacionEquipo } from "../../../utils/emailService";
import { capitalizeText, normalizeEmail } from "../../../utils/validations";
import { mapSupabaseRuleError } from "../../../utils/eventRules";
import logoImg from "@img/logo.webp";

import "@styles/Confirmacion.css";

// Variable de módulo: sobrevive desmonte/remonte de StrictMode
let _guardando = false;

const IgIcon = () => (
    <svg className="conf-ig-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="white" strokeWidth="2" fill="none" />
        <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" fill="none" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
    </svg>
);

export const ConfirmacionEquipo = ({
    eventoId,
    eventoSeleccionado,
    equipoFormData, // { formValues, jugadores, selectedGame }
    juegosSeleccionados, // juegos elegidos en el paso "juego" (para resolver el nombre de selectedGame)
    steamUsername,
    riotId,
}) => {
    const [estado, setEstado] = useState('guardando'); // 'guardando' | 'ok' | 'error'
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (_guardando) return;
        _guardando = true;
        guardarInscripcion().finally(() => { _guardando = false; });
    }, []);

    const guardarInscripcion = async () => {
        try {
            const { formValues, jugadores, selectedGame } = equipoFormData;

            // 1-2. Alta atómica de capitán + jugadores + games_inscriptions.
            // Antes esto eran N inserts sueltos (uno por integrante, cada uno
            // su propia request) — si el cupo se agotaba a mitad de camino,
            // el equipo quedaba parcialmente registrado (ver docs/inscripciones.md,
            // "Inscripción atómica de equipos"). El RPC corre todo dentro de
            // una única transacción de Postgres: si el trigger de cupo
            // (o el de edad, sobre cualquier integrante) rechaza el alta, no
            // queda NINGÚN integrante guardado — ver
            // supabase/migrations/20260824_event_game_cupos.sql,
            // register_team_inscription(). No se manda ningún id de usuario:
            // el RPC resuelve `user_id` con `auth.uid()` del lado del
            // servidor (sesión real de quien llama), no de un parámetro del
            // cliente — evita que alguien pueda asociar una inscripción a la
            // cuenta de otra persona llamando al RPC directo (ver el
            // comentario de seguridad en la migración).
            const jugadoresNorm = jugadores.map(jugador => ({
                nombre:   capitalizeText(jugador.nombre),
                apellido: capitalizeText(jugador.apellido),
                edad:     jugador.edad || null,
                email:    jugador.email ? normalizeEmail(jugador.email) : null,
                celular:  jugador.celular,
            }));

            const { data: rpcData, error: rpcError } = await supabase.rpc(
                "register_team_inscription",
                {
                    p_event_id: eventoId,
                    p_game_id: selectedGame,
                    p_captain: {
                        ...formValues,
                        steam_username: steamUsername || null,
                        riot_id: riotId || null,
                    },
                    p_players: jugadoresNorm,
                }
            );

            if (rpcError) throw rpcError;

            const capitanData = rpcData.captain;
            const jugadoresData = rpcData.players; // ya vienen normalizados (mismo insert que se mandó)

            // QR: se genera y guarda en el cliente, igual que antes — no es
            // parte de la atomicidad que garantiza el RPC (perder un QR es
            // recuperable con un update puntual; perder el cupo del equipo
            // no lo es).
            const qrStringCapitan = generateQRString({ ...capitanData, id_evento: eventoId });
            await supabase
                .from("inscriptions")
                .update({ qr_code: qrStringCapitan, asistencia: false })
                .eq("id", capitanData.id);

            capitanData.qr_code = qrStringCapitan;
            capitanData.id_evento = eventoId;

            const jugadoresConQR = [];
            for (const jugadorData of jugadoresData) {
                const qrStringJugador = generateQRString({ ...jugadorData, id_evento: eventoId });

                await supabase
                    .from("inscriptions")
                    .update({ qr_code: qrStringJugador, asistencia: false })
                    .eq("id", jugadorData.id);

                jugadoresConQR.push({
                    ...jugadorData,
                    id_evento: eventoId,
                    qr_code: qrStringJugador,
                });
            }

            // 3. Email de confirmación (best-effort) — las presentaciones no llevan mail de confirmación de torneo
            if (formValues.email && eventoSeleccionado?.tipo !== 'presentacion') {
                try {
                    // El equipo se inscribe a un único juego (`selectedGame`, ver arriba); se
                    // busca su nombre en `juegosSeleccionados` (juegos ofrecidos en el paso
                    // "juego") en vez de listar todos los juegos del evento.
                    const juegoInscripcion = (juegosSeleccionados || []).filter(j => j.id === selectedGame);
                    await enviarConfirmacionEquipo(
                        capitanData,
                        jugadoresConQR,
                        {
                            fecha_inicio:  eventoSeleccionado.fecha_inicio,
                            fecha_fin:     eventoSeleccionado.fecha_fin,
                            hora_inicio:   eventoSeleccionado.hora_inicio,
                            localidad:     eventoSeleccionado.localidad,
                            direccion:     eventoSeleccionado.direccion,
                            ubicacion_url: eventoSeleccionado.ubicacion_url,
                        },
                        juegoInscripcion
                    );
                } catch (emailError) {
                    console.error("Error al enviar confirmación por email:", emailError);
                }
            }

            setEstado('ok');
        } catch (err) {
            console.error("Error al guardar inscripción de equipo:", err);
            // Ver el mismo comentario en Confirmacion.jsx: mensaje específico si
            // Supabase rechazó por una regla del evento (edad de algún
            // integrante, límite de juegos, cupo agotado), genérico en
            // cualquier otro caso. `context: 'team'` hace que
            // EVENT_GAME_CUPO_EXCEEDED use el mensaje de equipo ("no entran
            // todos los integrantes") en vez del genérico de cupo individual.
            setErrorMsg(mapSupabaseRuleError(err, 'team') || "Hubo un error al guardar la inscripción. Intentá de nuevo.");
            setEstado('error');
        }
    };

    if (estado === 'guardando') {
        return (
            <div className="conf-loading">
                Guardando inscripción…
            </div>
        );
    }

    return (
        <div className="conf-page">
            <div className="conf-content">
                <img src={logoImg} alt="LC e-SPORTS" className="conf-logo" />
                <p className="conf-brand">Megaevento Gamer</p>
                <p className="conf-slogan">El gaming nos une</p>

                <h1 className="conf-titulo">¡Equipo adentro!</h1>

                {estado === 'ok' ? (
                    <p className="conf-texto">
                        La inscripción del equipo fue confirmada.<br />
                        Revisá el mail para los detalles.
                    </p>
                ) : (
                    <p className="conf-error-msg">{errorMsg}</p>
                )}

                {estado === 'ok' && (
                    <div className="conf-share-card">
                        <span className="conf-share-label">Compartí la inscripción</span>
                        <button
                            className="conf-instagram-btn"
                            type="button"
                            onClick={() => window.open('https://www.instagram.com/lcesports/', '_blank', 'noopener,noreferrer')}
                        >
                            <IgIcon />
                            Compartir en historias
                        </button>
                        <span className="conf-handle">@lcesports</span>
                    </div>
                )}
            </div>
        </div>
    );
};

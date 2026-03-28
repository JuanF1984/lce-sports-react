import { useState, useEffect } from "react";
import { useAuth } from "../../../context/UseAuth";
import supabase from "../../../utils/supabase";
import { generateQRString } from "../../../utils/qrCodeGenerator";
import { enviarConfirmacionEquipo } from "../../../utils/emailService";
import { capitalizeText, normalizeEmail } from "../../../utils/validations";
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
    juegosSeleccionados,
    steamUsername,
    riotId,
}) => {
    const { user } = useAuth();
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

            // 1. Inscribir al capitán
            const { data: capitanData, error: capitanError } = await supabase
                .from("inscriptions")
                .insert({
                    ...(user ? { user_id: user.id } : {}),
                    ...formValues,
                    id_evento: eventoId,
                    team_name: formValues.team_name,
                    ...(steamUsername ? { steam_username: steamUsername } : {}),
                    ...(riotId        ? { riot_id: riotId }               : {}),
                })
                .select()
                .single();

            if (capitanError) throw capitanError;

            const qrStringCapitan = generateQRString({ ...capitanData, id_evento: eventoId });

            await supabase
                .from("inscriptions")
                .update({ qr_code: qrStringCapitan, asistencia: false })
                .eq("id", capitanData.id);

            await supabase
                .from("games_inscriptions")
                .insert({ id_inscription: capitanData.id, id_game: selectedGame });

            capitanData.qr_code = qrStringCapitan;
            capitanData.id_evento = eventoId;

            // 2. Inscribir jugadores adicionales
            const jugadoresConQR = [];

            for (let i = 0; i < jugadores.length; i++) {
                const jugador = jugadores[i];
                const jugadorNorm = {
                    ...jugador,
                    nombre:   capitalizeText(jugador.nombre),
                    apellido: capitalizeText(jugador.apellido),
                    email:    jugador.email ? normalizeEmail(jugador.email) : null,
                };

                const { data: jugadorData, error: jugadorError } = await supabase
                    .from("inscriptions")
                    .insert({
                        ...(user ? { user_id: user.id } : {}),
                        nombre:    jugadorNorm.nombre,
                        apellido:  jugadorNorm.apellido,
                        edad:      jugadorNorm.edad || null,
                        email:     jugadorNorm.email || null,
                        celular:   jugadorNorm.celular,
                        localidad: formValues.localidad,
                        id_evento: eventoId,
                        team_name: formValues.team_name,
                    })
                    .select()
                    .single();

                if (jugadorError) throw jugadorError;

                const qrStringJugador = generateQRString({ ...jugadorData, id_evento: eventoId });

                await supabase
                    .from("inscriptions")
                    .update({ qr_code: qrStringJugador, asistencia: false })
                    .eq("id", jugadorData.id);

                await supabase
                    .from("games_inscriptions")
                    .insert({ id_inscription: jugadorData.id, id_game: selectedGame });

                jugadoresConQR.push({
                    ...jugadorNorm,
                    id: jugadorData.id,
                    id_evento: eventoId,
                    qr_code: qrStringJugador,
                });
            }

            // 3. Email de confirmación (best-effort)
            if (formValues.email) {
                try {
                    const juegoSeleccionado = juegosSeleccionados.find(g => g.id === selectedGame);
                    await enviarConfirmacionEquipo(
                        capitanData,
                        jugadoresConQR,
                        {
                            nombre:       eventoSeleccionado.nombre,
                            fecha_inicio: eventoSeleccionado.fecha_inicio,
                            hora_inicio:  eventoSeleccionado.hora_inicio,
                            localidad:    eventoSeleccionado.localidad,
                            direccion:    eventoSeleccionado.direccion,
                        },
                        juegoSeleccionado,
                        formValues.team_name
                    );
                } catch (emailError) {
                    console.error("Error al enviar confirmación por email:", emailError);
                }
            }

            setEstado('ok');
        } catch (err) {
            console.error("Error al guardar inscripción de equipo:", err);
            setErrorMsg("Hubo un error al guardar la inscripción. Intentá de nuevo.");
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

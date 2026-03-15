import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../context/UseAuth";
import supabase from "../../../utils/supabase";
import { generateQRString } from "../../../utils/qrCodeGenerator";
import { enviarConfirmacionIndividual } from "../../../utils/emailService";
import { capitalizeText, normalizeEmail } from "../../../utils/validations";
import logoImg from "@img/logo.webp";

import "@styles/Confirmacion.css";

// SVG inline del ícono de Instagram
const IgIcon = () => (
    <svg className="conf-ig-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="white" strokeWidth="2" fill="none" />
        <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" fill="none" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
    </svg>
);

export const Confirmacion = ({
    eventoId,
    eventoSeleccionado,
    formData,
    juegosSeleccionados,
    steamUsername,
    riotId,
}) => {
    const { user } = useAuth();
    const [estado, setEstado] = useState('guardando'); // 'guardando' | 'ok' | 'error'
    const [errorMsg, setErrorMsg] = useState('');
    const hasRun = useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;
        guardarInscripcion();
    }, []);

    const guardarInscripcion = async () => {
        try {
            const normalizedData = {
                ...formData,
                nombre:   capitalizeText(formData.nombre),
                apellido: capitalizeText(formData.apellido),
                email:    normalizeEmail(formData.email),
            };

            const dataToInsert = {
                ...normalizedData,
                id_evento: eventoId,
                ...(steamUsername ? { steam_username: steamUsername } : {}),
                ...(riotId        ? { riot_id: riotId }               : {}),
            };

            if (user?.id) dataToInsert.user_id = user.id;

            const { data: inscriptionData, error: insertError } = await supabase
                .from("inscriptions")
                .insert(dataToInsert)
                .select()
                .single();

            if (insertError) throw insertError;
            if (!inscriptionData) throw new Error("No se recibieron datos.");

            // QR
            const qrString = generateQRString(inscriptionData);
            await supabase
                .from("inscriptions")
                .update({ qr_code: qrString, asistencia: false })
                .eq("id", inscriptionData.id);

            // Juegos
            if (juegosSeleccionados.length > 0) {
                const gameRows = juegosSeleccionados.map(g => ({
                    id_inscription: inscriptionData.id,
                    id_game:        g.id,
                }));
                const { error: gameErr } = await supabase
                    .from("games_inscriptions")
                    .insert(gameRows);
                if (gameErr) throw gameErr;
            }

            // Email (best-effort)
            if (formData.email) {
                try {
                    await enviarConfirmacionIndividual(
                        { ...inscriptionData, qr_code: qrString },
                        {
                            localidad:    eventoSeleccionado?.localidad,
                            fecha_inicio: eventoSeleccionado?.fecha_inicio,
                            hora_inicio:  eventoSeleccionado?.hora_inicio,
                            direccion:    eventoSeleccionado?.direccion,
                        },
                        juegosSeleccionados.map(g => g.game_name)
                    );
                } catch (emailErr) {
                    console.error("Error al enviar email:", emailErr);
                }
            }

            setEstado('ok');
        } catch (err) {
            console.error("Error al guardar inscripción:", err);
            setErrorMsg("Hubo un error al guardar tu inscripción. Intentá de nuevo.");
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
                {/* Logo */}
                <img src={logoImg} alt="LC e-SPORTS" className="conf-logo" />

                {/* Marca */}
                <p className="conf-brand">Megaevento Gamer</p>
                <p className="conf-slogan">El gaming nos une</p>

                {/* Título */}
                <h1 className="conf-titulo">¡Estás adentro!</h1>

                {/* Texto */}
                {estado === 'ok' ? (
                    <p className="conf-texto">
                        Tu inscripción fue confirmada.<br />
                        Revisá tu mail para los detalles.
                    </p>
                ) : (
                    <p className="conf-error-msg">{errorMsg}</p>
                )}

                {/* Card de compartir */}
                {estado === 'ok' && (
                    <div className="conf-share-card">
                        <span className="conf-share-label">Compartí tu inscripción</span>
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

import { useState, useEffect } from "react";
import { useBackHandler } from "../../../context/BackHandlerContext";
import { useEventoSeleccionado } from "./hooks/useEventoSeleccionado";
import { useFormularioEquipo } from "../../../hooks/useFormularioEquipo";
import { capitalizeText, normalizeEmail } from "../../../utils/validations";

import { LogoNeon } from '../../common/LogoNeon';
import { useAuth } from "../../../context/UseAuth";
import { localidadesBuenosAires } from "../../../data/localidades";
import { getGameConfig } from "../../../data/gameConfig";
import { formatearHora } from "../../../utils/dateUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt } from "@fortawesome/free-solid-svg-icons";

import '@styles/FormularioDatos.css';

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    return `${DIAS_CORTOS[fecha.getDay()]} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

export const FormularioEquipo = ({ onBack, onNext, eventoId, juegosSeleccionados = [] }) => {
    const { isLoading } = useAuth();
    const { setBackHandler } = useBackHandler();

    useEffect(() => {
        setBackHandler(() => onBack);
        return () => setBackHandler(null);
    }, [onBack]);

    const { eventoSeleccionado, loadingEvento } = useEventoSeleccionado(eventoId);

    const {
        formValues,
        setFormValues,
        fieldErrors,
        setFieldErrors,
        jugadores,
        jugadoresErrors,
        setJugadoresErrors,
        selectedGame,
        setSelectedGame,
        errorMessage,
        setErrorMessage,
        showLoading,
        setShowLoading,
        formSubmitted,
        setFormSubmitted,
        handleInputChange,
        handleJugadorChange,
        addJugador,
        removeJugador,
        validateForm,
        resetForm,
    } = useFormularioEquipo();

    // Campos extra (UI only)
    const [emailRepetir, setEmailRepetir] = useState('');
    const [emailRepetirError, setEmailRepetirError] = useState('');
    const [aceptaTerminos, setAceptaTerminos] = useState(false);
    const [terminosError, setTerminosError] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const localidadesOptions = localidadesBuenosAires.map(l => ({ value: l, label: l }));

    // Pre-seleccionar el juego desde P3
    useEffect(() => {
        if (juegosSeleccionados.length > 0 && !selectedGame) {
            setSelectedGame(juegosSeleccionados[0].id);
        }
    }, [juegosSeleccionados]);

    // Pre-llenar localidad con la del evento
    useEffect(() => {
        if (eventoSeleccionado?.localidad && !formValues.localidad) {
            setFormValues(prev => ({ ...prev, localidad: eventoSeleccionado.localidad }));
        }
    }, [eventoSeleccionado]);

    useEffect(() => {
        if (isLoading) setShowLoading(true);
        else setShowLoading(false);
    }, [isLoading, setShowLoading]);

    // Cálculo de pasos
    const needsSteam = juegosSeleccionados.some(g => getGameConfig(g.game_name).verifyType === 'steam');
    const needsRiot  = juegosSeleccionados.some(g => getGameConfig(g.game_name).verifyType === 'riot');
    const totalPasos = 3 + (needsSteam ? 1 : 0) + (needsRiot ? 1 : 0) + 1;
    const pasoActual = 3;
    const progreso   = Math.round((pasoActual / totalPasos) * 100);

    const stepBadges = [
        ...Array.from({ length: pasoActual - 1 }, (_, i) => i + 1),
        ...(totalPasos > pasoActual ? [totalPasos] : []),
    ];

    const fechaCorta = formatearFechaCorta(eventoSeleccionado?.fecha_inicio);
    const hora       = formatearHora(eventoSeleccionado?.hora_inicio);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (submitting) return;
        setFormSubmitted(true);
        setErrorMessage("");

        if (!eventoSeleccionado?.id) {
            setErrorMessage("No se ha seleccionado ningún evento válido.");
            return;
        }

        // Validar emailRepetir y términos
        let repError = '';
        if (!emailRepetir) repError = 'Repetir email es requerido';
        else if (emailRepetir !== formValues.email) repError = 'Los emails no coinciden';
        setEmailRepetirError(repError);

        const noTerminos = !aceptaTerminos;
        setTerminosError(noTerminos);

        const isValid = validateForm();

        if (!isValid || repError || noTerminos) {
            setErrorMessage("Por favor, completá todos los campos obligatorios.");
            const firstError = document.querySelector('.fd-input--error, .fd-select--error');
            if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const normalizedFormValues = {
            ...formValues,
            nombre:   capitalizeText(formValues.nombre),
            apellido: capitalizeText(formValues.apellido),
            email:    normalizeEmail(formValues.email),
        };

        setSubmitting(true);
        onNext({ formValues: normalizedFormValues, jugadores, selectedGame });
    };

    if (showLoading) return <LogoNeon onClose={() => setShowLoading(false)} />;

    return (
        <main className="fd-page">
            {/* Barra de info del evento */}
            <div className="fd-event-bar">
                <p className="fd-event-text">
                    {eventoSeleccionado?.localidad}
                    {fechaCorta && <> · {fechaCorta}</>}
                    {hora && <> · {hora}</>}
                </p>
                <button className="fd-event-link" onClick={onBack} type="button">
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    {' '}Ver detalles &gt;
                </button>
            </div>

            {/* Barra de progreso */}
            <div className="fd-progress-wrap">
                <div className="fd-progress-header">
                    <span className="fd-paso-text">Paso {pasoActual} de {totalPasos}</span>
                    <div className="fd-step-badges">
                        {stepBadges.map(n => (
                            <span key={n} className={`fd-step-badge${n < pasoActual ? ' fd-step-badge--done' : ''}`}>
                                {n}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="fd-progress-bar">
                    <div className="fd-progress-fill" style={{ width: `${progreso}%` }} />
                </div>
            </div>

            {/* Badges de juegos */}
            {juegosSeleccionados.length > 0 && (
                <div className="fd-juegos-badges">
                    {juegosSeleccionados.map(j => (
                        <span key={j.id} className="fd-juego-badge">{j.game_name}</span>
                    ))}
                </div>
            )}

            {/* Título */}
            <h2 className="fd-titulo">Tus datos</h2>

            <form className="fd-form" onSubmit={handleSubmit} noValidate>

                {/* Nombre del equipo */}
                <div className="fd-group">
                    <label className="fd-label">
                        Nombre del equipo<span className="fd-required">*</span>
                    </label>
                    <input
                        className={`fd-input${fieldErrors.team_name ? ' fd-input--error' : ''}`}
                        type="text"
                        name="team_name"
                        value={formValues.team_name}
                        onChange={handleInputChange}
                        placeholder="Ej: Los Campeones"
                    />
                    {fieldErrors.team_name && <span className="fd-error-text">Requerido</span>}
                </div>

                {/* ── Capitán ── */}
                <p className="fd-section-title">Datos del capitán</p>

                <div className="fd-row-2">
                    <div className="fd-group">
                        <label className="fd-label">Nombre<span className="fd-required">*</span></label>
                        <input
                            className={`fd-input${fieldErrors.nombre ? ' fd-input--error' : ''}`}
                            type="text" name="nombre"
                            value={formValues.nombre} onChange={handleInputChange}
                            placeholder="Tomás"
                        />
                        {fieldErrors.nombre && <span className="fd-error-text">Requerido</span>}
                    </div>
                    <div className="fd-group">
                        <label className="fd-label">Apellido<span className="fd-required">*</span></label>
                        <input
                            className={`fd-input${fieldErrors.apellido ? ' fd-input--error' : ''}`}
                            type="text" name="apellido"
                            value={formValues.apellido} onChange={handleInputChange}
                            placeholder="Pérez"
                        />
                        {fieldErrors.apellido && <span className="fd-error-text">Requerido</span>}
                    </div>
                </div>

                <div className="fd-group">
                    <label className="fd-label">Edad<span className="fd-required">*</span></label>
                    <input
                        className={`fd-input${fieldErrors.edad || fieldErrors.edadFormat ? ' fd-input--error' : ''}`}
                        type="text" inputMode="numeric" name="edad"
                        value={formValues.edad} onChange={handleInputChange}
                        placeholder="18"
                    />
                    {fieldErrors.edad && <span className="fd-error-text">Requerido</span>}
                    {fieldErrors.edadFormat && <span className="fd-error-text">Solo números</span>}
                </div>

                <div className="fd-group">
                    <label className="fd-label">Email<span className="fd-required">*</span></label>
                    <input
                        className={`fd-input${fieldErrors.email || fieldErrors.emailFormat ? ' fd-input--error' : ''}`}
                        type="email" name="email"
                        value={formValues.email} onChange={handleInputChange}
                        placeholder="tomas@gmail.com"
                    />
                    {fieldErrors.email && <span className="fd-error-text">Requerido</span>}
                    {fieldErrors.emailFormat && <span className="fd-error-text">Email inválido</span>}
                </div>

                <div className="fd-group">
                    <label className="fd-label">Repetir email<span className="fd-required">*</span></label>
                    <input
                        className={`fd-input${emailRepetirError ? ' fd-input--error' : ''}`}
                        type="email"
                        value={emailRepetir}
                        onChange={e => setEmailRepetir(e.target.value)}
                        placeholder="tomas@gmail.com"
                    />
                    {emailRepetirError
                        ? <span className="fd-error-text">{emailRepetirError}</span>
                        : <span className="fd-helper">Te enviaremos la confirmación a este email.</span>
                    }
                </div>

                <div className="fd-group">
                    <label className="fd-label">Celular<span className="fd-required">*</span></label>
                    <div className={`fd-celular-wrap${fieldErrors.celular || fieldErrors.celularFormat ? ' fd-celular-wrap--error' : ''}`}>
                        <span className="fd-celular-prefix">🇦🇷 +54 9</span>
                        <input
                            className="fd-celular-input"
                            type="tel" name="celular"
                            value={formValues.celular} onChange={handleInputChange}
                            placeholder="11 2456 7890"
                        />
                    </div>
                    {fieldErrors.celular && <span className="fd-error-text">Requerido</span>}
                    {fieldErrors.celularFormat && <span className="fd-error-text">Debe tener entre 8 y 15 dígitos</span>}
                </div>

                <div className="fd-group">
                    <label className="fd-label">Localidad<span className="fd-required">*</span></label>
                    <div className="fd-select-wrap">
                        <select
                            className={`fd-select${fieldErrors.localidad ? ' fd-select--error' : ''}`}
                            name="localidad"
                            value={formValues.localidad} onChange={handleInputChange}
                        >
                            <option value="">Seleccioná una localidad</option>
                            {localidadesOptions.map((l, i) => (
                                <option key={i} value={l.value}>{l.label}</option>
                            ))}
                        </select>
                    </div>
                    {fieldErrors.localidad && <span className="fd-error-text">Requerido</span>}
                </div>

                {/* ── Jugadores ── */}
                <p className="fd-section-title">Miembros del equipo</p>

                {jugadores.map((jugador, index) => (
                    <div key={index} className="fd-jugador-card">
                        <div className="fd-jugador-header">
                            <span className="fd-jugador-title">Jugador {index + 1}</span>
                            {jugadores.length > 1 && (
                                <button type="button" className="fd-remove-btn" onClick={() => removeJugador(index)}>
                                    Eliminar
                                </button>
                            )}
                        </div>

                        <div className="fd-row-2">
                            <div className="fd-group">
                                <label className="fd-label">Nombre<span className="fd-required">*</span></label>
                                <input
                                    className={`fd-input${jugadoresErrors[index]?.nombre ? ' fd-input--error' : ''}`}
                                    type="text"
                                    value={jugador.nombre}
                                    onChange={e => handleJugadorChange(index, 'nombre', e.target.value)}
                                    placeholder="Nombre"
                                />
                                {jugadoresErrors[index]?.nombre && <span className="fd-error-text">Requerido</span>}
                            </div>
                            <div className="fd-group">
                                <label className="fd-label">Apellido<span className="fd-required">*</span></label>
                                <input
                                    className={`fd-input${jugadoresErrors[index]?.apellido ? ' fd-input--error' : ''}`}
                                    type="text"
                                    value={jugador.apellido}
                                    onChange={e => handleJugadorChange(index, 'apellido', e.target.value)}
                                    placeholder="Apellido"
                                />
                                {jugadoresErrors[index]?.apellido && <span className="fd-error-text">Requerido</span>}
                            </div>
                        </div>

                        <div className="fd-group">
                            <label className="fd-label">Edad<span className="fd-required">*</span></label>
                            <input
                                className={`fd-input${jugadoresErrors[index]?.edad || jugadoresErrors[index]?.edadFormat ? ' fd-input--error' : ''}`}
                                type="text" inputMode="numeric"
                                value={jugador.edad}
                                onChange={e => handleJugadorChange(index, 'edad', e.target.value)}
                                placeholder="18"
                            />
                            {jugadoresErrors[index]?.edad && <span className="fd-error-text">Requerido</span>}
                            {jugadoresErrors[index]?.edadFormat && <span className="fd-error-text">Solo números</span>}
                        </div>

                        <div className="fd-group">
                            <label className="fd-label">Email</label>
                            <input
                                className={`fd-input${jugadoresErrors[index]?.emailFormat ? ' fd-input--error' : ''}`}
                                type="email"
                                value={jugador.email}
                                onChange={e => handleJugadorChange(index, 'email', e.target.value)}
                                placeholder="jugador@gmail.com"
                            />
                            {jugadoresErrors[index]?.emailFormat && <span className="fd-error-text">Email inválido</span>}
                        </div>

                        <div className="fd-group">
                            <label className="fd-label">Celular</label>
                            <div className={`fd-celular-wrap${jugadoresErrors[index]?.celular || jugadoresErrors[index]?.celularFormat ? ' fd-celular-wrap--error' : ''}`}>
                                <span className="fd-celular-prefix">🇦🇷 +54 9</span>
                                <input
                                    className="fd-celular-input"
                                    type="tel"
                                    value={jugador.celular}
                                    onChange={e => handleJugadorChange(index, 'celular', e.target.value)}
                                    placeholder="11 2456 7890"
                                />
                            </div>
                            {jugadoresErrors[index]?.celular && <span className="fd-error-text">Requerido</span>}
                            {jugadoresErrors[index]?.celularFormat && <span className="fd-error-text">Debe tener entre 8 y 15 dígitos</span>}
                        </div>
                    </div>
                ))}

                <button type="button" className="fd-add-btn" onClick={addJugador}>
                    + Agregar jugador
                </button>

                {/* Términos */}
                <label className="fd-checkbox-group">
                    <input type="checkbox" checked={aceptaTerminos} onChange={e => setAceptaTerminos(e.target.checked)} />
                    <span className="fd-checkbox-label">
                        Acepto <a href="#" onClick={e => e.preventDefault()}>términos y condiciones</a>
                        <span className="fd-required"> *</span>
                    </span>
                </label>
                {terminosError && <span className="fd-error-text">Debés aceptar los términos</span>}

                {errorMessage && <div className="fd-error-message">{errorMessage}</div>}

                <button type="submit" className="main-button fd-submit-btn" disabled={submitting}>
                    {submitting ? 'Procesando...' : 'Siguiente'}
                </button>

            </form>
        </main>
    );
};

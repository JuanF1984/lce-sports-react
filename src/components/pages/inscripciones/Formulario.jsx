import { useState, useEffect } from "react";
import { useBackHandler } from "../../../context/BackHandlerContext";

import { useEventoSeleccionado } from "./hooks/useEventoSeleccionado";

import { useFormulario } from "../../../hooks/useFormulario";
import { validateEmail as validateEmailStrict } from "../../../lib/email/validateEmail";
import { validatePhone, validateAge } from "../../../utils/validations";

import { LogoNeon } from '../../common/LogoNeon';
import { useAuth } from "../../../context/UseAuth";
import { localidadesBuenosAires } from "../../../data/localidades";
import { getGameConfig } from "../../../data/gameConfig";
import { formatearHora } from "../../../utils/dateUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt } from "@fortawesome/free-solid-svg-icons";
import { EventoModal } from "./common/EventoModal";

import '@styles/FormularioDatos.css';

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    return `${DIAS_CORTOS[fecha.getDay()]} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

export const Formulario = ({ onBack, onNext, eventoId, juegosSeleccionados = [] }) => {
    const { isLoading } = useAuth();
    const { setBackHandler } = useBackHandler();
    useEffect(() => {
        setBackHandler(() => onBack);
        return () => setBackHandler(null);
    }, [onBack]);

    const {
        eventoSeleccionado,
        loadingEvento,
    } = useEventoSeleccionado(eventoId);

    const {
        formValues,
        setFormValues,
        fieldErrors,
        setFieldErrors,
        errorMessage,
        setErrorMessage,
        showLoading,
        setShowLoading,
        formSubmitted,
        setFormSubmitted,
        handleInputChange,
    } = useFormulario();

    // Campos extra (UI only)
    const [emailRepetir, setEmailRepetir] = useState('');
    const [emailRepetirError, setEmailRepetirError] = useState('');
    const [emailErrorMsg, setEmailErrorMsg] = useState('');
    const [showModal, setShowModal] = useState(false);

    const localidadesOptions = localidadesBuenosAires.map((l) => ({ value: l, label: l }));

    // Calcular total de pasos según juegos seleccionados
    const needsSteam = juegosSeleccionados.some(g => getGameConfig(g.game_name).verifyType === 'steam');
    const needsRiot  = juegosSeleccionados.some(g => getGameConfig(g.game_name).verifyType === 'riot');
    const totalPasos = 3 + (needsSteam ? 1 : 0) + (needsRiot ? 1 : 0) + 1;
    const pasoActual = 3;
    const progreso   = Math.round((pasoActual / totalPasos) * 100);

    const stepBadges = [
        ...Array.from({ length: pasoActual - 1 }, (_, i) => i + 1),
        ...(totalPasos > pasoActual ? [totalPasos] : []),
    ];

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

    const validateFormNuevo = () => {
        const { nombre, apellido, celular, localidad, email, edad } = formValues;

        let repError = '';
        if (!emailRepetir) repError = 'Repetir email es requerido';
        else if (emailRepetir !== email) repError = 'Los emails no coinciden';
        setEmailRepetirError(repError);

        const emailTrim = email.trim();
        let emailFormatError = false;
        if (emailTrim) {
            const emailResult = validateEmailStrict(emailTrim);
            if (!emailResult.valid) {
                emailFormatError = true;
                setEmailErrorMsg(emailResult.reason);
            } else {
                setEmailErrorMsg('');
            }
        } else {
            setEmailErrorMsg('');
        }

        const newErrors = {
            nombre:        !nombre.trim(),
            apellido:      !apellido.trim(),
            celular:       !celular.trim(),
            celularFormat: celular.trim() ? !validatePhone(celular.trim()) : false,
            localidad:     !localidad,
            email:         !emailTrim,
            emailFormat:   emailFormatError,
            edad:          !edad.trim(),
            edadFormat:    edad.trim() ? !validateAge(edad.trim()) : false,
            selectedGames: false,
        };
        setFieldErrors(newErrors);

        const hasErrors = Object.values(newErrors).some(Boolean) || repError;
        return !hasErrors;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormSubmitted(true);
        setErrorMessage("");

        if (!eventoSeleccionado) {
            setErrorMessage("No se ha seleccionado ningún evento válido.");
            return;
        }

        const isValid = validateFormNuevo();

        if (!isValid) {
            setErrorMessage("Por favor, completá todos los campos obligatorios.");
            const firstError = document.querySelector('.fd-input--error, .fd-select--error');
            if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        onNext(formValues);
    };

    const fechaCorta = formatearFechaCorta(eventoSeleccionado?.fecha_inicio);
    const hora       = formatearHora(eventoSeleccionado?.hora_inicio);

    const btnLabel = (needsSteam || needsRiot) ? 'Siguiente' : 'Confirmar inscripción';

    if (showLoading) return <LogoNeon onClose={() => setShowLoading(false)} />;

    return (
        <main className="fd-page">
            {showModal && <EventoModal evento={eventoSeleccionado} onClose={() => setShowModal(false)} />}

            {/* Barra de info del evento */}
            <div className="fd-event-bar">
                <p className="fd-event-text">
                    {eventoSeleccionado?.localidad}
                    {fechaCorta && <> · {fechaCorta}</>}
                    {hora && <> · {hora}</>}
                </p>
                <button className="fd-event-link" onClick={() => setShowModal(true)} type="button">
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
                            <span
                                key={n}
                                className={`fd-step-badge${n < pasoActual ? ' fd-step-badge--done' : ''}`}
                            >
                                {n}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="fd-progress-bar">
                    <div className="fd-progress-fill" style={{ width: `${progreso}%` }} />
                </div>
            </div>

            {/* Badges de juegos seleccionados */}
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

                {/* Nombre + Apellido en 2 columnas */}
                <div className="fd-row-2">
                    <div className="fd-group">
                        <label className="fd-label">
                            Nombre<span className="fd-required">*</span>
                        </label>
                        <input
                            className={`fd-input${fieldErrors.nombre ? ' fd-input--error' : ''}`}
                            type="text"
                            name="nombre"
                            value={formValues.nombre}
                            onChange={handleInputChange}
                            placeholder="Tomás"
                        />
                        {fieldErrors.nombre && <span className="fd-error-text">Requerido</span>}
                    </div>
                    <div className="fd-group">
                        <label className="fd-label">
                            Apellido<span className="fd-required">*</span>
                        </label>
                        <input
                            className={`fd-input${fieldErrors.apellido ? ' fd-input--error' : ''}`}
                            type="text"
                            name="apellido"
                            value={formValues.apellido}
                            onChange={handleInputChange}
                            placeholder="Pérez"
                        />
                        {fieldErrors.apellido && <span className="fd-error-text">Requerido</span>}
                    </div>
                </div>

                {/* Edad */}
                <div className="fd-group">
                    <label className="fd-label">
                        Edad<span className="fd-required">*</span>
                    </label>
                    <input
                        className={`fd-input${fieldErrors.edad || fieldErrors.edadFormat ? ' fd-input--error' : ''}`}
                        type="text"
                        inputMode="numeric"
                        name="edad"
                        value={formValues.edad}
                        onChange={handleInputChange}
                        placeholder="18"
                    />
                    {fieldErrors.edad && <span className="fd-error-text">Requerido</span>}
                    {fieldErrors.edadFormat && <span className="fd-error-text">Solo números</span>}
                </div>

                {/* Email */}
                <div className="fd-group">
                    <label className="fd-label">
                        Email<span className="fd-required">*</span>
                    </label>
                    <input
                        className={`fd-input${fieldErrors.email || fieldErrors.emailFormat || emailErrorMsg ? ' fd-input--error' : ''}`}
                        type="email"
                        name="email"
                        value={formValues.email}
                        onChange={e => {
                            handleInputChange(e);
                            const val = e.target.value.trim();
                            if (!val) { setEmailErrorMsg(''); return; }
                            const result = validateEmailStrict(val);
                            setEmailErrorMsg(result.valid ? '' : result.reason);
                        }}
                        placeholder="tomas@gmail.com"
                    />
                    {fieldErrors.email && <span className="fd-error-text">Requerido</span>}
                    {(fieldErrors.emailFormat || emailErrorMsg) && !fieldErrors.email && (
                        <span className="fd-error-text">{emailErrorMsg || 'Email inválido'}</span>
                    )}
                </div>

                {/* Repetir email */}
                <div className="fd-group">
                    <label className="fd-label">
                        Repetir email<span className="fd-required">*</span>
                    </label>
                    <input
                        className={`fd-input${emailRepetirError ? ' fd-input--error' : ''}`}
                        type="email"
                        value={emailRepetir}
                        onChange={e => setEmailRepetir(e.target.value)}
                        placeholder="tomas@gmail.com"
                    />
                    {emailRepetirError
                        ? <span className="fd-error-text">{emailRepetirError}</span>
                        : <span className="fd-helper">Te enviaremos la confirmación y la info del juego a este email.</span>
                    }
                </div>

                {/* Celular con prefijo */}
                <div className="fd-group">
                    <label className="fd-label">
                        Celular<span className="fd-required">*</span>
                    </label>
                    <div className={`fd-celular-wrap${fieldErrors.celular || fieldErrors.celularFormat ? ' fd-celular-wrap--error' : ''}`}>
                        <span className="fd-celular-prefix">🇦🇷 +54 9</span>
                        <input
                            className="fd-celular-input"
                            type="tel"
                            name="celular"
                            value={formValues.celular}
                            onChange={handleInputChange}
                            placeholder="11 2456 7890"
                        />
                    </div>
                    {fieldErrors.celular && <span className="fd-error-text">Requerido</span>}
                    {fieldErrors.celularFormat && <span className="fd-error-text">Debe tener entre 8 y 15 dígitos</span>}
                </div>

                {/* Localidad */}
                <div className="fd-group">
                    <label className="fd-label">
                        Localidad<span className="fd-required">*</span>
                    </label>
                    <div className="fd-select-wrap">
                        <select
                            className={`fd-select${fieldErrors.localidad ? ' fd-select--error' : ''}`}
                            name="localidad"
                            value={formValues.localidad}
                            onChange={handleInputChange}
                        >
                            <option value="">Seleccioná una localidad</option>
                            {localidadesOptions.map((l, i) => (
                                <option key={i} value={l.value}>{l.label}</option>
                            ))}
                        </select>
                    </div>
                    {fieldErrors.localidad && <span className="fd-error-text">Requerido</span>}
                </div>

                {/* Error general */}
                {errorMessage && (
                    <div className="fd-error-message">{errorMessage}</div>
                )}

                {/* Botón */}
                <button
                    type="submit"
                    className="main-button fd-submit-btn"
                    disabled={!!emailErrorMsg}
                    style={emailErrorMsg ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                    {btnLabel}
                </button>

            </form>
        </main>
    );
};

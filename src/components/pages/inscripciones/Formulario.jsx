import { useState, useEffect } from "react";

import { EventoInfo } from "./common/EventoInfo";
import { useEventoSeleccionado } from "./hooks/useEventoSeleccionado";

import { useFormulario } from "../../../hooks/useFormulario";
import { capitalizeText, normalizeEmail } from "../../../utils/validations";

import supabase from "../../../utils/supabase";
import { LogoNeon } from '../../common/LogoNeon';
import { useAuth } from "../../../context/UseAuth";
import { useEventGames } from "../../../hooks/useEventGames";
import { localidadesBuenosAires } from "../../../data/localidades";
import { enviarConfirmacionIndividual } from "../../../utils/emailService";
import { generateQRString } from "../../../utils/qrCodeGenerator";
import '../../../styles/Formulario.css';

export const Formulario = ({ onBack, eventoId }) => {
    const { user, isLoading } = useAuth();

    // Cargar datos del evento seleccionado usando custom hook useEventoSeleccionado
    const {
        eventoSeleccionado,
        loadingEvento,
        errorMessage: eventoErrorMessage
    } = useEventoSeleccionado(eventoId);

    // Usar el hook useEventGames con el ID del evento seleccionado
    const { eventGames, loading: loadingGames, error: errorGames } = useEventGames(
        eventoSeleccionado ? [eventoSeleccionado.id] : []
    );

    const games = eventoSeleccionado?.id ? eventGames[eventoSeleccionado.id] || [] : [];

    const [selectedGames, setSelectedGames] = useState([]);

    // Usar el hook useFormulario
    const {
        formValues,
        setFormValues,
        fieldErrors,
        setFieldErrors,
        errorMessage,
        setErrorMessage,
        successMessage,
        setSuccessMessage,
        showLoading,
        setShowLoading,
        isSaving,
        setIsSaving,
        formSubmitted,
        setFormSubmitted,
        handleInputChange, // Ahora usamos handleInputChange del hook
        validateForm
    } = useFormulario();

    const localidadesOptions = localidadesBuenosAires.map((localidad) => ({
        value: localidad,
        label: localidad,
    }));

    // Manejamos el estado de carga de la autenticación
    useEffect(() => {
        if (isLoading) {
            setShowLoading(true);
        } else {
            setShowLoading(false);
        }
    }, [isLoading, setShowLoading]);

    // Ya no necesitamos definir handleInputChange, usamos el del hook

    const handleCheckboxChange = (gameId) => {
        const newSelectedGames = selectedGames.includes(gameId)
            ? selectedGames.filter((id) => id !== gameId)
            : [...selectedGames, gameId];

        setSelectedGames(newSelectedGames);

        // Si el formulario ha sido enviado, validar los juegos seleccionados en tiempo real
        if (formSubmitted) {
            setFieldErrors(prev => ({
                ...prev,
                selectedGames: newSelectedGames.length === 0
            }));
        }
    };

    const handleModalAccept = () => {
        setSuccessMessage("");
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setFormSubmitted(true);
        setErrorMessage("");

        if (!eventoSeleccionado) {
            setErrorMessage("No se ha seleccionado ningún evento válido.");
            setIsSaving(false);
            return;
        }

        // Validar el formulario pasando selectedGames como parámetro
        const isValid = validateForm(selectedGames);

        if (!isValid) {
            setErrorMessage("Por favor, completa todos los campos obligatorios.");
            // Hacer scroll al primer error
            const firstErrorElement = document.querySelector('.error-field');
            if (firstErrorElement) {
                firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            setIsSaving(false);
            return;
        }

        try {
            // Importamos capitalizeText y normalizeEmail de utils/validations
            const normalizedFormValues = {
                ...formValues,
                nombre: capitalizeText(formValues.nombre),
                apellido: capitalizeText(formValues.apellido),
                email: normalizeEmail(formValues.email),
            };

            // Objeto con los datos a insertar
            const dataToInsert = {
                ...normalizedFormValues,
                id_evento: eventoSeleccionado.id,
            };

            // Se agrega user_id si user.id existe
            if (user && user.id) {
                dataToInsert.user_id = user.id;
            }

            // Insertar en la tabla inscriptions y obtener los datos insertados
            const { data: inscriptionData, error: insertError } = await supabase
                .from("inscriptions")
                .insert(dataToInsert)
                .select() // .select() para obtener los datos insertados
                .single();

            if (insertError) {
                throw insertError;
            }

            if (!inscriptionData) {
                throw new Error("No se recibieron datos de la inscripción.");
            }

            // Generar código QR único para esta inscripción
            const qrString = generateQRString(inscriptionData);

            // Actualizar la inscripción con el código QR
            const { error: qrUpdateError } = await supabase
                .from("inscriptions")
                .update({
                    qr_code: qrString,
                    asistencia: false
                })
                .eq("id", inscriptionData.id);

            if (qrUpdateError) {
                console.error("Error al guardar código QR:", qrUpdateError);
                // No detenemos el flujo si falla la actualización del QR
            }

            // Crear las inscripciones de juegos usando el ID obtenido
            if (selectedGames.length > 0) {
                const gameInscriptions = selectedGames.map(gameId => ({
                    id_inscription: inscriptionData.id, // Usar directamente inscriptionData.id
                    id_game: gameId,
                }));

                const { error: gameInsertError } = await supabase
                    .from("games_inscriptions")
                    .insert(gameInscriptions);

                if (gameInsertError) {
                    console.error(gameInsertError)
                    throw gameInsertError;
                }
            }

            if (formValues.email) {
                try {
                    // Obtener nombres de los juegos seleccionados
                    const juegosSeleccionados = selectedGames.map(gameId => {
                        const juego = games.find(g => g.id === gameId);
                        return juego ? juego.game_name : 'Juego no especificado';
                    });

                    // Pasar la inscripción actualizada con el QR ya generado
                    const inscriptionWithQR = {
                        ...inscriptionData,
                        qr_code: qrString
                    };

                    await enviarConfirmacionIndividual(
                        inscriptionWithQR, // datos de la inscripción con QR
                        {
                            localidad: eventoSeleccionado.localidad,
                            fecha_inicio: eventoSeleccionado.fecha_inicio,
                            hora_inicio: eventoSeleccionado.hora_inicio,
                            direccion: eventoSeleccionado.direccion,
                        },
                        juegosSeleccionados
                    );

                } catch (emailError) {
                    console.error("Error al enviar confirmación por email:", emailError);
                    // No interrumpimos el flujo si el email falla
                }
            }

            // Limpiar el formulario y mostrar mensaje de éxito
            setSuccessMessage("Inscripción realizada con éxito.");
            setFormValues({
                nombre: "",
                apellido: "",
                edad: "",
                email: "",
                celular: "",
                localidad: "",
            });
            setSelectedGames([]);
            setFormSubmitted(false);
            setFieldErrors({
                nombre: false,
                apellido: false,
                email: false,
                emailFormat: false,
                celular: false,
                celularFormat: false,
                localidad: false,
                selectedGames: false,
                edad: false,
                edadFormat: false
            });

        } catch (err) {
            setErrorMessage("Hubo un error al procesar tu solicitud. Intenta nuevamente.");
            console.error("Error:", err);
        }
        setIsSaving(false);
    };

    // Estilos CSS adicionales para los campos con error
    const errorStyle = {
        border: '1px solid red',
    };

    // Contenido para indicar que el campo es requerido
    const requiredFieldIndicator = (isError) => (
        <span className={`required-field ${isError ? 'error-text' : ''}`}>*</span>
    );

    // Formatear la hora (eliminar segundos si los hay)
    const formatearHora = (hora) => {
        if (!hora) return '';
        return hora.slice(0, 5); // Obtener solo HH:MM
    };

    return (
        <>
            {showLoading ? (
                <LogoNeon onClose={() => setShowLoading(false)} />
            ) : (
                <main>
                    <div className="form-container">
                        <h3>Formulario Inscripción al Torneo</h3>
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="export-button"
                            >
                                ← Volver
                            </button>
                        )}
                        <EventoInfo evento={eventoSeleccionado} loading={loadingEvento} />
                        <form onSubmit={handleSubmit} className="inscription-form">
                            <div className="form-group">
                                <label>
                                    Nombre:{requiredFieldIndicator(fieldErrors.nombre)}
                                    <input
                                        type="text"
                                        name="nombre"
                                        value={formValues.nombre}
                                        onChange={handleInputChange}
                                        className={fieldErrors.nombre ? 'error-field' : ''}
                                        style={fieldErrors.nombre ? errorStyle : {}}
                                    />
                                </label>
                                {fieldErrors.nombre && (
                                    <p className="error-text">Nombre es requerido</p>
                                )}
                            </div>
                            <div className="form-group">
                                <label>
                                    Apellido:{requiredFieldIndicator(fieldErrors.apellido)}
                                    <input
                                        type="text"
                                        name="apellido"
                                        value={formValues.apellido}
                                        onChange={handleInputChange}
                                        className={fieldErrors.apellido ? 'error-field' : ''}
                                        style={fieldErrors.apellido ? errorStyle : {}}
                                    />
                                </label>
                                {fieldErrors.apellido && (
                                    <p className="error-text">Apellido es requerido</p>
                                )}
                            </div>
                            <div className="form-group">
                                <label>
                                    Edad:{requiredFieldIndicator(fieldErrors.edad)}
                                    <input
                                        type="text"
                                        name="edad"
                                        value={formValues.edad}
                                        onChange={handleInputChange}
                                    />
                                </label>
                                {fieldErrors.edad && (
                                    <p className="error-text">Edad es requerido</p>
                                )}
                            </div>
                            <div className="form-group">
                                <label>
                                    Email:{requiredFieldIndicator(fieldErrors.email)}
                                    <input
                                        type="email"
                                        name="email"
                                        value={formValues.email}
                                        onChange={handleInputChange}
                                        className={fieldErrors.email ? 'error-field' : ''}
                                        style={fieldErrors.email ? errorStyle : {}}
                                    />
                                </label>
                                {fieldErrors.email && (
                                    <p className="error-text">Email es requerido</p>
                                )}
                                {fieldErrors.emailFormat && (
                                    <p className="error-text">Formato de email inválido</p>
                                )}
                            </div>
                            <div className="form-group">
                                <label>
                                    Celular:{requiredFieldIndicator(fieldErrors.celular)}
                                    <input
                                        type="tel"
                                        name="celular"
                                        value={formValues.celular}
                                        onChange={handleInputChange}
                                        className={fieldErrors.celular ? 'error-field' : ''}
                                        style={fieldErrors.celular ? errorStyle : {}}
                                    />
                                </label>
                                {fieldErrors.celular && (
                                    <p className="error-text">Celular es requerido</p>
                                )}
                                {fieldErrors.celularFormat && (
                                    <p className="error-text">El celular debe contener entre 8 y 15 dígitos numéricos</p>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Juegos:{requiredFieldIndicator(fieldErrors.selectedGames)}</label>

                                {loadingGames && <p>Cargando juegos...</p>}
                                {errorGames && <p>Error al cargar juegos: {errorGames}</p>}

                                <div className={`checkbox-grid ${fieldErrors.selectedGames ? 'error-field' : ''}`}
                                    style={fieldErrors.selectedGames ? { ...errorStyle, padding: '10px' } : {}}>
                                    {!loadingGames && !errorGames && games?.length > 0 ? (
                                        games.map((game) => (
                                            <label key={game.id}>
                                                <input
                                                    type="checkbox"
                                                    value={game.id}
                                                    checked={selectedGames.includes(game.id)}
                                                    onChange={() => handleCheckboxChange(game.id)}
                                                />
                                                {game.game_name}
                                            </label>
                                        ))
                                    ) : (
                                        !loadingGames && <p>No hay juegos disponibles.</p>
                                    )}
                                </div>
                                {fieldErrors.selectedGames && (
                                    <p className="error-text">Debes seleccionar al menos un juego</p>
                                )}
                            </div>
                            <div className="form-group">
                                <label>
                                    Localidad:{requiredFieldIndicator(fieldErrors.localidad)}
                                    <select
                                        name="localidad"
                                        value={formValues.localidad}
                                        onChange={handleInputChange}
                                        className={fieldErrors.localidad ? 'error-field' : ''}
                                        style={fieldErrors.localidad ? errorStyle : {}}
                                    >
                                        <option value="">Selecciona una localidad</option>
                                        {localidadesOptions.map((localidad, index) => (
                                            <option key={index} value={localidad.value}>
                                                {localidad.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                {fieldErrors.localidad && (
                                    <p className="error-text">Localidad es requerida</p>
                                )}
                            </div>
                            {errorMessage && (
                                <p className="error-message">{errorMessage}</p>
                            )}
                            {successMessage && (
                                <div className="modal-insc-overlay">
                                    <div className="modal-insc-content">
                                        <h3>¡Registro exitoso!</h3>
                                        <p>Se registró correctamente al torneo</p>
                                        <p>A la brevedad te llegará mail de confirmación. Revisa spam por las dudas</p>
                                        <p>¡Nos vemos en el torneo!</p>

                                        <button onClick={handleModalAccept}>Aceptar</button>
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="main-button"
                                disabled={isSaving}
                            >
                                {isSaving ? 'Guardando...' : 'Enviar inscripción'}
                            </button>
                        </form>
                    </div>
                </main>
            )}
        </>
    )
}
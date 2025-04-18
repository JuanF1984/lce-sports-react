import React, { useState, useEffect } from "react";

import supabase from "../../../utils/supabase";

import { LogoNeon } from '../../common/LogoNeon';

import { useAuth } from "../../../context/UseAuth";

import { useProximoEvento } from "../../../hooks/useProximoEvento";

import { useEventGames } from "../../../hooks/useEventGames";

import { localidadesBuenosAires } from "../../../data/localidades";

import { enviarConfirmacionIndividual } from "../../../utils/emailService";

import { generateQRString } from "../../../utils/qrCodeGenerator";


import '../../../styles/Formulario.css';

export const Formulario = ({ onBack }) => {
    // Función para capitalizar cada palabra (primera letra mayúscula, resto minúsculas)
    const capitalizeText = (text) => {
        if (!text) return '';

        // Dividir el texto por espacios, capitalizar cada palabra y volver a unir
        return text
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .filter(word => word) // Eliminar palabras vacías que podrían surgir de múltiples espacios
            .join(' ');
    };

    // Función para normalizar emails (todo a minúsculas)
    const normalizeEmail = (email) => {
        if (!email) return '';
        return email.trim().toLowerCase();
    };


    const { user, isLoading } = useAuth();
    const [formValues, setFormValues] = useState({
        nombre: "",
        apellido: "",
        edad: "",
        email: "",
        celular: "",
        localidad: "",
    });

    // Estado para controlar campos con error
    const [fieldErrors, setFieldErrors] = useState({
        nombre: false,
        apellido: false,
        email: false,
        emailFormat: false,
        celular: false,
        celularFormat: false,
        localidad: false,
        selectedGames: false,
        edad: false
    });

    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [showLoading, setShowLoading] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    const { proximoEvento, fecha_inicio, fecha_fin, localidad, loading, diaSemana, hora_inicio } = useProximoEvento();
    const { eventGames, loading: loadingGames, error: errorGames } = useEventGames(proximoEvento ? [proximoEvento.id] : []);

    const games = proximoEvento?.id ? eventGames[proximoEvento.id] || [] : [];

    const [selectedGames, setSelectedGames] = useState([]);

    const localidadesOptions = localidadesBuenosAires.map((localidad) => ({
        value: localidad,
        label: localidad,
    }));

    const [isSaving, setIsSaving] = useState(false);

    // Funciones para validar email y teléfono
    const validateEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    const validatePhone = (phone) => {
        // Validar que sea numérico y tenga entre 8 y 15 dígitos
        const regex = /^\d{8,15}$/;
        return regex.test(phone);
    };

    // Función para validar que la edad sea solo números
    const validateAge = (age) => {
        const regex = /^\d+$/;  // Solo dígitos
        return regex.test(age);
    };

    useEffect(() => {
        if (isLoading) {
            setShowLoading(true);
        } else {
            setShowLoading(false); // Si hay usuario, ocultar el loading.
        }
    }, [isLoading]);

    // Función para validar el formulario
    const validateForm = () => {
        const { nombre, apellido, celular, localidad, email, edad } = formValues;

        // Reiniciar errores
        const newFieldErrors = {
            nombre: !nombre,
            apellido: !apellido,
            celular: !celular,
            celularFormat: celular ? !validatePhone(celular) : false,
            localidad: !localidad,
            email: !email,
            emailFormat: email ? !validateEmail(email) : false,
            edad: !edad,
            edadFormat: edad ? !validateAge(edad) : false,
            edadFormat: false,
            selectedGames: selectedGames.length === 0
        };

        setFieldErrors(newFieldErrors);

        // Verificar si hay algún error en el formulario
        const hasErrors = Object.values(newFieldErrors).some(error => error);

        return !hasErrors;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Para el campo de edad, solo permitir dígitos
        if (name === "edad" && value !== "" && !/^\d*$/.test(value)) {
            // No actualizar el estado si se intenta ingresar algo que no sea un número
            return;
        }

        setFormValues((prev) => ({ ...prev, [name]: value }));

        // Si el formulario ha sido enviado, validar el campo en tiempo real
        if (formSubmitted) {
            if (name === 'email') {
                setFieldErrors(prev => ({
                    ...prev,
                    [name]: value.trim() === "",
                    emailFormat: value.trim() !== "" && !validateEmail(value)
                }));
            } else if (name === 'celular') {
                setFieldErrors(prev => ({
                    ...prev,
                    [name]: value.trim() === "",
                    celularFormat: value.trim() !== "" && !validatePhone(value)
                }));
            } else {
                setFieldErrors(prev => ({
                    ...prev,
                    [name]: value.trim() === ""
                }));
            }
        }
    };

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

        // Validar el formulario
        const isValid = validateForm();

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
            // Normalizar los datos antes de insertar
            const normalizedFormValues = {
                ...formValues,
                nombre: capitalizeText(formValues.nombre),
                apellido: capitalizeText(formValues.apellido),
                email: normalizeEmail(formValues.email),
            };

            // Objeto con los datos a insertar
            const dataToInsert = {
                ...normalizedFormValues,
                id_evento: proximoEvento.id,
            };

            // Se agrega user_id si user.id existe
            if (user && user.id) {
                dataToInsert.user_id = user.id;
            }

            // Insertar en la tabla inscriptions y obtener los datos insertados
            const { data: inscriptionData, error: insertError } = await supabase
                .from("inscriptions")
                .insert(dataToInsert)
                .select() //  .select() para obtener los datos insertados
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
                            nombre: proximoEvento.nombre,
                            fecha_inicio: fecha_inicio,
                            hora_inicio: hora_inicio,
                            localidad: localidad
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
        setIsSaving(false)
    };

    // Estilos CSS adicionales para los campos con error
    const errorStyle = {
        border: '1px solid red',
    };

    // Contenido para indicar que el campo es requerido
    const requiredFieldIndicator = (isError) => (
        <span className={`required-field ${isError ? 'error-text' : ''}`}>*</span>
    );

    return (
        <>
            {showLoading ?
                (<LogoNeon onClose={() => setShowLoading(false)} />
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
                            <div className="info-text">
                                {loading ? (
                                    <p>Cargando...</p>
                                ) : (
                                    <>
                                        <p>Fecha del torneo: {diaSemana} {fecha_inicio}</p>
                                        {fecha_inicio !== fecha_fin && (
                                            <p> al {fecha_fin}</p>
                                        )}
                                        <p>Hora de inicio: {hora_inicio.slice(0, 5)}</p>
                                        <p>Lugar: {localidad}</p>
                                        <p>El evento es libre y gratuito</p>
                                    </>
                                )}
                            </div>
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
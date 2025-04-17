import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import supabase from "../../../utils/supabase";

import { LogoNeon } from '../../common/LogoNeon';

import { useAuth } from "../../../context/UseAuth";

import { useProximoEvento } from "../../../hooks/useProximoEvento";

import { useEventGames } from "../../../hooks/useEventGames";

import { localidadesBuenosAires } from "../../../data/localidades";

import { enviarConfirmacionEquipo } from "../../../utils/emailService";

import { generateQRString } from "../../../utils/qrCodeGenerator";


export const FormularioEquipo = ({ onBack }) => {
    const navigate = useNavigate();
    const { user, isLoading } = useAuth();

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

    const validateAge = (age) => {
        // Validar que sea un número entero positivo (sin decimales)
        const regex = /^[1-9][0-9]*$/;
        return regex.test(age);
    };

    // Datos del capitán
    const [formValues, setFormValues] = useState({
        nombre: "",
        apellido: "",
        edad: "",
        email: "",
        celular: "",
        localidad: "",
        team_name: "",
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
        team_name: false,
        selectedGame: false,
        edad: false,
        edadFormat: false
    });

    // Estado para controlar errores en los campos de jugadores
    const [jugadoresErrors, setJugadoresErrors] = useState([
        { nombre: false, apellido: false, celular: false, celularFormat: false, email: false, emailFormat: false, edad: false, edadFormat: false }
    ]);

    // Datos de los miembros del equipo
    const [jugadores, setJugadores] = useState([
        { nombre: "", apellido: "", edad: "", celular: "", email: "" }
    ]);

    // Juego seleccionado para todo el equipo
    const [selectedGame, setSelectedGame] = useState("");

    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [showLoading, setShowLoading] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    const { proximoEvento, fecha_inicio, fecha_fin, localidad, loading, hora_inicio } = useProximoEvento();
    const { eventGames, loading: loadingGames, error: errorGames } = useEventGames(proximoEvento ? [proximoEvento.id] : []);

    // Filtrar solo juegos que permiten equipos
    const juegosEquipo = proximoEvento?.id ?
        (eventGames[proximoEvento.id] || []).filter(game => game.team_option) :
        [];

    const localidadesOptions = localidadesBuenosAires.map((localidad) => ({
        value: localidad,
        label: localidad,
    }));

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isLoading) {
            setShowLoading(true);
        } else {
            setShowLoading(false); // Si hay usuario, ocultar el loading.
        }
    }, [isLoading]);

    // Función para validar el formulario
    const validateForm = () => {
        const { nombre, apellido, celular, localidad, team_name, email, edad } = formValues;

        // Reiniciar errores
        const newFieldErrors = {
            nombre: !nombre,
            apellido: !apellido,
            celular: !celular,
            celularFormat: celular && !validatePhone(celular),
            localidad: !localidad,
            team_name: !team_name,
            email: !email,
            emailFormat: email && !validateEmail(email),
            selectedGame: !selectedGame,
            edad: !edad,
            edadFormat: edad && !validateAge(edad)
        };

        setFieldErrors(newFieldErrors);

        // Validar jugadores
        const newJugadoresErrors = jugadores.map(jugador => ({
            nombre: !jugador.nombre,
            apellido: !jugador.apellido,
            celular: !jugador.celular,
            celularFormat: jugador.celular && !validatePhone(jugador.celular),
            email: !jugador.email,
            emailFormat: jugador.email && !validateEmail(jugador.email),
            edad: !jugador.edad,
            edadFormat: jugador.edad && !validateAge(jugador.edad)
        }));

        setJugadoresErrors(newJugadoresErrors);

        // Verificar si hay algún error en el formulario
        const hasCapitanErrors = Object.values(newFieldErrors).some(error => error);
        const hasJugadoresErrors = newJugadoresErrors.some(jugador =>
            Object.values(jugador).some(error => error)
        );

        return !hasCapitanErrors && !hasJugadoresErrors;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormValues((prev) => ({ ...prev, [name]: value }));

        // Si el formulario ha sido enviado, validar el campo en tiempo real
        if (formSubmitted) {
            if (name === "email") {
                setFieldErrors(prev => ({
                    ...prev,
                    [name]: value.trim() === "",
                    emailFormat: value.trim() !== "" && !validateEmail(value)
                }));
            } else if (name === "celular") {
                setFieldErrors(prev => ({
                    ...prev,
                    [name]: value.trim() === "",
                    celularFormat: value.trim() !== "" && !validatePhone(value)
                }));
            } else if (name === "edad") {
                setFieldErrors(prev => ({
                    ...prev,
                    [name]: value.trim() === "",
                    edadFormat: value.trim() !== "" && !validateAge(value)
                }));
            } else {
                setFieldErrors(prev => ({
                    ...prev,
                    [name]: value.trim() === ""
                }));
            }
        }
    };

    const handleJugadorChange = (index, field, value) => {
        setJugadores(prev => {
            const newJugadores = [...prev];
            newJugadores[index] = {
                ...newJugadores[index],
                [field]: value
            };
            return newJugadores;
        });

        // Si el formulario ha sido enviado, validar el campo en tiempo real
        if (formSubmitted) {
            if (field === "email") {
                setJugadoresErrors(prev => {
                    const newErrors = [...prev];
                    newErrors[index] = {
                        ...newErrors[index],
                        [field]: value.trim() === "",
                        emailFormat: value.trim() !== "" && !validateEmail(value)
                    };
                    return newErrors;
                });
            } else if (field === "celular") {
                setJugadoresErrors(prev => {
                    const newErrors = [...prev];
                    newErrors[index] = {
                        ...newErrors[index],
                        [field]: value.trim() === "",
                        celularFormat: value.trim() !== "" && !validatePhone(value)
                    };
                    return newErrors;
                });
            } else if (field === "edad") {
                setJugadoresErrors(prev => {
                    const newErrors = [...prev];
                    newErrors[index] = {
                        ...newErrors[index],
                        [field]: value.trim() === "",
                        edadFormat: value.trim() !== "" && !validateAge(value)
                    };
                    return newErrors;
                });
            } else {
                setJugadoresErrors(prev => {
                    const newErrors = [...prev];
                    newErrors[index] = {
                        ...newErrors[index],
                        [field]: value.trim() === ""
                    };
                    return newErrors;
                });
            }
        }
    };

    const handleGameChange = (e) => {
        const value = e.target.value;
        setSelectedGame(value);

        if (formSubmitted) {
            setFieldErrors(prev => ({
                ...prev,
                selectedGame: value === ""
            }));
        }
    };

    const addJugador = () => {
        setJugadores(prev => [...prev, { nombre: "", apellido: "", edad: "", celular: "", email: "" }]);
        setJugadoresErrors(prev => [...prev, {
            nombre: false,
            apellido: false,
            celular: false,
            celularFormat: false,
            email: false,
            emailFormat: false,
            edad: false,
            edadFormat: false
        }]);
    };

    const removeJugador = (index) => {
        if (jugadores.length > 1) {
            setJugadores(prev => prev.filter((_, i) => i !== index));
            setJugadoresErrors(prev => prev.filter((_, i) => i !== index));
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
            setIsSaving(false)
            return;
        }

        try {
            const { nombre, apellido, celular, localidad, team_name, email } = formValues;

            // 1. Inscribir al capitán
            const { data: capitanData, error: capitanError } = await supabase
                .from("inscriptions")
                .insert({
                    ...(user ? { user_id: user.id } : {}),
                    ...formValues,
                    id_evento: proximoEvento.id,
                    team_name: team_name // Nombre del equipo
                })
                .select()
                .single();

            if (capitanError) {
                throw capitanError;
            }

            // Asegurarse de que capitanData tenga el id_evento para el QR
            const capitanDataCompleto = {
                ...capitanData,
                id_evento: proximoEvento.id // Aseguramos que tenga el id_evento
            };

            // Generar código QR único para el capitán con datos completos
            const qrStringCapitan = generateQRString(capitanDataCompleto);

            // Actualizar la inscripción del capitán con el código QR
            const { error: qrCapitanUpdateError } = await supabase
                .from("inscriptions")
                .update({
                    qr_code: qrStringCapitan,
                    asistencia: false
                })
                .eq("id", capitanData.id);

            if (qrCapitanUpdateError) {
                console.error("Error al guardar código QR del capitán:", qrCapitanUpdateError);
                // No detenemos el flujo si falla la actualización del QR
            }

            // 2. Crear la inscripción del juego para el capitán
            const { error: gameInsertCapitanError } = await supabase
                .from("games_inscriptions")
                .insert({
                    id_inscription: capitanData.id,
                    id_game: selectedGame,
                });

            if (gameInsertCapitanError) {
                throw gameInsertCapitanError;
            }

            // Actualizar capitanData con el QR generado y el id_evento para uso posterior en el email
            capitanData.qr_code = qrStringCapitan;
            capitanData.id_evento = proximoEvento.id; // Aseguramos que tenga el id_evento

            // Array para almacenar los datos de todos los jugadores con sus QRs
            const jugadoresConQR = [];

            // 3. Inscribir a cada jugador adicional
            for (let i = 0; i < jugadores.length; i++) {
                const jugador = jugadores[i];

                // Crear inscripción para el jugador
                const { data: jugadorData, error: jugadorError } = await supabase
                    .from("inscriptions")
                    .insert({
                        ...(user ? { user_id: user.id } : {}),
                        nombre: jugador.nombre,
                        apellido: jugador.apellido,
                        edad: jugador.edad || null,
                        email: jugador.email || null,
                        celular: jugador.celular,
                        localidad: formValues.localidad, // Misma localidad que el capitán
                        id_evento: proximoEvento.id,
                        team_name: team_name // Mismo nombre de equipo
                    })
                    .select()
                    .single();

                if (jugadorError) {
                    throw jugadorError;
                }

                // Asegurarse de que jugadorData tenga el id_evento para el QR
                // Esto es necesario porque a veces Supabase no devuelve todos los campos en el select()
                const jugadorDataCompleto = {
                    ...jugadorData,
                    id_evento: proximoEvento.id // Aseguramos que tenga el id_evento
                };

                // Generar código QR único para este jugador con datos completos
                const qrStringJugador = generateQRString(jugadorDataCompleto);

                // Actualizar la inscripción del jugador con el código QR
                const { error: qrJugadorUpdateError } = await supabase
                    .from("inscriptions")
                    .update({
                        qr_code: qrStringJugador,
                        asistencia: false
                    })
                    .eq("id", jugadorData.id);

                if (qrJugadorUpdateError) {
                    console.error(`Error al guardar código QR del jugador ${i + 1}:`, qrJugadorUpdateError);
                    // No detenemos el flujo si falla la actualización del QR
                }

                // Crear inscripción del juego para este jugador
                const { error: gameInsertJugadorError } = await supabase
                    .from("games_inscriptions")
                    .insert({
                        id_inscription: jugadorData.id,
                        id_game: selectedGame,
                    });

                if (gameInsertJugadorError) {
                    throw gameInsertJugadorError;
                }

                // Guardar jugador con su QR para uso posterior
                jugadoresConQR.push({
                    ...jugador,
                    id: jugadorData.id,
                    id_evento: proximoEvento.id, // Aseguramos que tenga el id_evento
                    qr_code: qrStringJugador
                });
            }

            const juegoSeleccionado = juegosEquipo.find(game => game.id === selectedGame);

            // Si el capitán tiene email, enviar confirmación
            if (formValues.email) {
                try {
                    await enviarConfirmacionEquipo(
                        capitanData, // datos del capitán con QR
                        jugadoresConQR,  // datos de los jugadores con QRs
                        {
                            nombre: proximoEvento.nombre,
                            fecha_inicio: fecha_inicio,
                            hora_inicio: hora_inicio,
                            localidad: localidad
                        },
                        juegoSeleccionado,
                        formValues.team_name
                    );
                } catch (emailError) {
                    console.error("Error al enviar confirmación por email:", emailError);
                    // No interrumpimos el flujo si el email falla
                }
            }

            // Limpiar el formulario y mostrar mensaje de éxito
            setSuccessMessage("Inscripción de equipo realizada con éxito.");
            setFormValues({
                nombre: "",
                apellido: "",
                edad: "",
                email: "",
                celular: "",
                localidad: "",
                team_name: "",
            });
            setJugadores([{ nombre: "", apellido: "", edad: "", celular: "", email: "" }]);
            setSelectedGame("");
            setFormSubmitted(false);
            setFieldErrors({
                nombre: false,
                apellido: false,
                email: false,
                celular: false,
                localidad: false,
                team_name: false,
                selectedGame: false,
                edad: false
            });
            setJugadoresErrors([{
                nombre: false,
                apellido: false,
                celular: false,
                celularFormat: false,
                email: false,
                emailFormat: false,
                edad: false,
                edadFormat: false
            }]);

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
            {showLoading ? (
                <LogoNeon onClose={() => setShowLoading(false)} />
            ) : (
                <main>
                    <div className="form-container">
                        <h3>Formulario Inscripción de Equipo al Torneo</h3>

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
                                    <p>Fecha del torneo: {fecha_inicio}</p>
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
                            {/* Selección de juego para todo el equipo */}
                            <div className="form-group game-selection">
                                <label>
                                    Juego al que se inscribirá el equipo:{requiredFieldIndicator(fieldErrors.selectedGame)}
                                </label>
                                {loadingGames && <p>Cargando juegos...</p>}
                                {errorGames && <p>Error al cargar juegos: {errorGames}</p>}

                                <select
                                    value={selectedGame}
                                    onChange={handleGameChange}
                                    className={`game-select ${fieldErrors.selectedGame ? 'error-field' : ''}`}
                                    style={fieldErrors.selectedGame ? errorStyle : {}}
                                >
                                    <option value="">Selecciona un juego</option>
                                    {juegosEquipo.map((game) => (
                                        <option key={game.id} value={game.id}>
                                            {game.game_name}
                                        </option>
                                    ))}
                                </select>
                                {fieldErrors.selectedGame && (
                                    <p className="error-text">Debes seleccionar un juego</p>
                                )}
                            </div>

                            <div className="form-group">
                                <label>
                                    Nombre del Equipo:{requiredFieldIndicator(fieldErrors.team_name)}
                                    <input
                                        type="text"
                                        name="team_name"
                                        value={formValues.team_name}
                                        onChange={handleInputChange}
                                        className={fieldErrors.team_name ? 'error-field' : ''}
                                        style={fieldErrors.team_name ? errorStyle : {}}
                                    />
                                </label>
                                {fieldErrors.team_name && (
                                    <p className="error-text">Nombre del equipo es requerido</p>
                                )}
                            </div>

                            <h4>Datos del Capitán</h4>
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
                                {fieldErrors.edadFormat && (
                                    <p className="error-text">La edad debe ser un número entero positivo</p>
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
                                    <p className="error-text">El celular debe tener entre 8 y 15 dígitos</p>
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

                            <h4>Miembros del Equipo</h4>

                            {jugadores.map((jugador, index) => (
                                <div key={index} className="jugador-container">
                                    <h5>Jugador {index + 1}</h5>
                                    <div className="form-group">
                                        <label>
                                            Nombre:{requiredFieldIndicator(jugadoresErrors[index]?.nombre)}
                                            <input
                                                type="text"
                                                value={jugador.nombre}
                                                onChange={(e) => handleJugadorChange(index, "nombre", e.target.value)}
                                                className={jugadoresErrors[index]?.nombre ? 'error-field' : ''}
                                                style={jugadoresErrors[index]?.nombre ? errorStyle : {}}
                                            />
                                        </label>
                                        {jugadoresErrors[index]?.nombre && (
                                            <p className="error-text">Nombre es requerido</p>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Apellido:{requiredFieldIndicator(jugadoresErrors[index]?.apellido)}
                                            <input
                                                type="text"
                                                value={jugador.apellido}
                                                onChange={(e) => handleJugadorChange(index, "apellido", e.target.value)}
                                                className={jugadoresErrors[index]?.apellido ? 'error-field' : ''}
                                                style={jugadoresErrors[index]?.apellido ? errorStyle : {}}
                                            />
                                        </label>
                                        {jugadoresErrors[index]?.apellido && (
                                            <p className="error-text">Apellido es requerido</p>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Edad:{requiredFieldIndicator(jugadoresErrors[index]?.edad)}
                                            <input
                                                type="text"
                                                value={jugador.edad}
                                                onChange={(e) => handleJugadorChange(index, "edad", e.target.value)}
                                                className={jugadoresErrors[index]?.edad || jugadoresErrors[index]?.edadFormat ? 'error-field' : ''}
                                                style={(jugadoresErrors[index]?.edad || jugadoresErrors[index]?.edadFormat) ? errorStyle : {}}
                                            />
                                        </label>
                                        {jugadoresErrors[index]?.edad && (
                                            <p className="error-text">Edad es requerido</p>
                                        )}
                                        {jugadoresErrors[index]?.edadFormat && (
                                            <p className="error-text">La edad debe ser un número entero positivo</p>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Email:{requiredFieldIndicator(jugadoresErrors[index]?.email)}
                                            <input
                                                type="email"
                                                value={jugador.email}
                                                onChange={(e) => handleJugadorChange(index, "email", e.target.value)}
                                                className={jugadoresErrors[index]?.email || jugadoresErrors[index]?.emailFormat ? 'error-field' : ''}
                                                style={(jugadoresErrors[index]?.email || jugadoresErrors[index]?.emailFormat) ? errorStyle : {}}
                                            />
                                        </label>
                                        {jugadoresErrors[index]?.email && (
                                            <p className="error-text">Email es requerido</p>
                                        )}
                                        {jugadoresErrors[index]?.emailFormat && (
                                            <p className="error-text">Formato de email inválido</p>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Celular:{requiredFieldIndicator(jugadoresErrors[index]?.celular)}
                                            <input
                                                type="tel"
                                                value={jugador.celular}
                                                onChange={(e) => handleJugadorChange(index, "celular", e.target.value)}
                                                className={jugadoresErrors[index]?.celular || jugadoresErrors[index]?.celularFormat ? 'error-field' : ''}
                                                style={(jugadoresErrors[index]?.celular || jugadoresErrors[index]?.celularFormat) ? errorStyle : {}}
                                            />
                                        </label>
                                        {jugadoresErrors[index]?.celular && (
                                            <p className="error-text">Celular es requerido</p>
                                        )}
                                        {jugadoresErrors[index]?.celularFormat && (
                                            <p className="error-text">El celular debe tener entre 8 y 15 dígitos</p>
                                        )}
                                    </div>

                                    {jugadores.length > 1 && (
                                        <button
                                            type="button"
                                            className="remove-button"
                                            onClick={() => removeJugador(index)}
                                        >
                                            Eliminar Jugador
                                        </button>
                                    )}
                                </div>
                            ))}

                            <button
                                type="button"
                                className="export-button"
                                onClick={addJugador}
                            >
                                + Agregar Jugador
                            </button>

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
                                {isSaving ? 'Guardando...' : 'Inscribir Equipo'}
                            </button>
                        </form>
                    </div>
                </main>
            )}

        </>
    );
};
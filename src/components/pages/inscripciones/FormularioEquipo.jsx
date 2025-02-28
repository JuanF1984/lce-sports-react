import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import supabase from "../../../utils/supabase";

import { LogoNeon } from '../../common/LogoNeon';

import { useAuth } from "../../../context/UseAuth";

import { useProximoEvento } from "../../../hooks/useProximoEvento";

import { useEventGames } from "../../../hooks/useEventGames";

import { localidadesBuenosAires } from "../../../data/localidades";

import { enviarConfirmacionEquipo } from "../../../utils/emailService";


import '../../../styles/Formulario.css';

export const FormularioEquipo = ({ onBack }) => {
    const navigate = useNavigate();
    const { user, isLoading } = useAuth();

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
        celular: false,
        localidad: false,
        team_name: false,
        selectedGame: false
    });

    // Estado para controlar errores en los campos de jugadores
    const [jugadoresErrors, setJugadoresErrors] = useState([
        { nombre: false, apellido: false, celular: false, email: false }
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
    const { proximoEvento, fecha_inicio, fecha_fin, localidad, loading } = useProximoEvento();
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
            if (!user) {
                navigate("/"); // Si no hay usuario, redirigir.
            } else {
                setShowLoading(false); // Si hay usuario, ocultar el loading.
            }
        }
    }, [isLoading, user, navigate]);

    // Función para validar el formulario
    const validateForm = () => {
        const { nombre, apellido, celular, localidad, team_name, email } = formValues;

        // Reiniciar errores
        const newFieldErrors = {
            nombre: !nombre,
            apellido: !apellido,
            celular: !celular,
            localidad: !localidad,
            team_name: !team_name,
            email: !email,
            selectedGame: !selectedGame
        };

        setFieldErrors(newFieldErrors);

        // Validar jugadores
        const newJugadoresErrors = jugadores.map(jugador => ({
            nombre: !jugador.nombre,
            apellido: !jugador.apellido,
            celular: !jugador.celular,
            email: !jugador.email
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
            setFieldErrors(prev => ({
                ...prev,
                [name]: value.trim() === ""
            }));
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
            setJugadoresErrors(prev => {
                const newErrors = [...prev];
                newErrors[index] = {
                    ...newErrors[index],
                    [field]: value.trim() === ""
                };
                return newErrors;
            });
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
        setJugadoresErrors(prev => [...prev, { nombre: false, apellido: false, celular: false, email: false }]);
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
            return;
        }

        try {
            const { nombre, apellido, celular, localidad, team_name, email } = formValues;

            // 1. Inscribir al capitán
            const { data: capitanData, error: capitanError } = await supabase
                .from("inscriptions")
                .insert({
                    user_id: user.id,
                    ...formValues,
                    id_evento: proximoEvento.id,
                    team_name: team_name // Nombre del equipo
                })
                .select()
                .single();

            if (capitanError) {
                throw capitanError;
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

            // 3. Inscribir a cada jugador adicional
            for (let i = 0; i < jugadores.length; i++) {
                const jugador = jugadores[i];

                // Crear inscripción para el jugador
                const { data: jugadorData, error: jugadorError } = await supabase
                    .from("inscriptions")
                    .insert({
                        user_id: user.id, // El mismo usuario que crea el equipo
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
            }
            const juegoSeleccionado = juegosEquipo.find(game => game.id === selectedGame);

            // Si el capitán tiene email, enviar confirmación
            if (formValues.email) {
                try {
                    await enviarConfirmacionEquipo(
                        formValues, // datos del capitán
                        jugadores,  // datos de los jugadores
                        {
                            nombre: proximoEvento.nombre,
                            fecha_inicio: fecha_inicio,
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
                selectedGame: false
            });
            setJugadoresErrors([{ nombre: false, apellido: false, celular: false, email: false }]);

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
                                    <p>Lugar: {localidad}</p>
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
                                    Edad:
                                    <input
                                        type="text"
                                        name="edad"
                                        value={formValues.edad}
                                        onChange={handleInputChange}
                                    />
                                </label>
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
                                            Edad:
                                            <input
                                                type="text"
                                                value={jugador.edad}
                                                onChange={(e) => handleJugadorChange(index, "edad", e.target.value)}
                                            />
                                        </label>
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Email:{requiredFieldIndicator(jugadoresErrors[index]?.email)}
                                            <input
                                                type="email"
                                                value={jugador.email}
                                                onChange={(e) => handleJugadorChange(index, "email", e.target.value)}
                                                className={jugadoresErrors[index]?.email ? 'error-field' : ''}
                                                style={jugadoresErrors[index]?.email ? errorStyle : {}}
                                            />
                                        </label>
                                        {jugadoresErrors[index]?.email && (
                                            <p className="error-text">Email es requerido</p>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Celular:{requiredFieldIndicator(jugadoresErrors[index]?.celular)}
                                            <input
                                                type="tel"
                                                value={jugador.celular}
                                                onChange={(e) => handleJugadorChange(index, "celular", e.target.value)}
                                                className={jugadoresErrors[index]?.celular ? 'error-field' : ''}
                                                style={jugadoresErrors[index]?.celular ? errorStyle : {}}
                                            />
                                        </label>
                                        {jugadoresErrors[index]?.celular && (
                                            <p className="error-text">Celular es requerido</p>
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
                                        <p>
                                            Se registró correctamente el equipo al torneo. Ante cualquier duda, comuníquese al
                                            celular (011) 1234-5678.
                                        </p>
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
            <style jsx>{`
                .error-field {
                    border: 1px solid red;
                }
                
                .error-text {
                    color: red;
                    font-size: 0.8rem;
                    margin-top: 2px;
                    margin-bottom: 5px;
                }
                
                .required-field {
                    margin-left: 3px;
                }
                
                .required-field.error-text {
                    font-weight: bold;
                }
            `}</style>
        </>
    );
};
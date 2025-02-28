import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import supabase from "../../../utils/supabase";

import { LogoNeon } from '../../common/LogoNeon';

import { useAuth } from "../../../context/UseAuth";

import { useProximoEvento } from "../../../hooks/useProximoEvento";

import { useEventGames } from "../../../hooks/useEventGames";

import { localidadesBuenosAires } from "../../../data/localidades";


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
    
    // Datos de los miembros del equipo
    const [jugadores, setJugadores] = useState([
        { nombre: "", apellido: "", edad: "", celular: "", email: "" }
    ]);
    
    // Juego seleccionado para todo el equipo
    const [selectedGame, setSelectedGame] = useState("");
    
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [showLoading, setShowLoading] = useState(false);
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

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormValues((prev) => ({ ...prev, [name]: value }));
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
    };

    const addJugador = () => {
        setJugadores(prev => [...prev, { nombre: "", apellido: "", edad: "", celular: "", email: "" }]);
    };

    const removeJugador = (index) => {
        if (jugadores.length > 1) {
            setJugadores(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleModalAccept = () => {
        setSuccessMessage("");
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        const { nombre, apellido, celular, localidad, team_name } = formValues;

        // Validaciones
        if (!selectedGame) {
            setErrorMessage("Por favor, selecciona un juego para el equipo.");
            return;
        }

        if (!nombre || !apellido || !celular || !localidad || !team_name) {
            setErrorMessage("Por favor, completa todos los campos obligatorios del capitán.");
            return;
        }

        // Validar que todos los jugadores adicionales tengan nombre, apellido y celular
        const jugadoresValidos = jugadores.every(j => {
            if (!j.nombre || !j.apellido || !j.celular) return false;
            return true;
        });
        
        if (!jugadoresValidos) {
            setErrorMessage("Todos los jugadores deben tener nombre, apellido y celular.");
            return;
        }

        try {
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

        } catch (err) {
            setErrorMessage("Hubo un error al procesar tu solicitud. Intenta nuevamente.");
            console.error("Error:", err);
        }
    };

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
                                <label>Juego al que se inscribirá el equipo:*</label>
                                {loadingGames && <p>Cargando juegos...</p>}
                                {errorGames && <p>Error al cargar juegos: {errorGames}</p>}

                                <select
                                    value={selectedGame}
                                    onChange={(e) => setSelectedGame(e.target.value)}
                                    className="game-select"
                                >
                                    <option value="">Selecciona un juego</option>
                                    {juegosEquipo.map((game) => (
                                        <option key={game.id} value={game.id}>
                                            {game.game_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="form-group">
                                <label>
                                    Nombre del Equipo:*
                                    <input
                                        type="text"
                                        name="team_name"
                                        value={formValues.team_name}
                                        onChange={handleInputChange}
                                    />
                                </label>
                            </div>
                            
                            <h4>Datos del Capitán</h4>
                            <div className="form-group">
                                <label>
                                    Nombre:*
                                    <input
                                        type="text"
                                        name="nombre"
                                        value={formValues.nombre}
                                        onChange={handleInputChange}
                                    />
                                </label>
                            </div>
                            <div className="form-group">
                                <label>
                                    Apellido:*
                                    <input
                                        type="text"
                                        name="apellido"
                                        value={formValues.apellido}
                                        onChange={handleInputChange}
                                    />
                                </label>
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
                                    Email:
                                    <input
                                        type="email"
                                        name="email"
                                        value={formValues.email}
                                        onChange={handleInputChange}
                                    />
                                </label>
                            </div>
                            <div className="form-group">
                                <label>
                                    Celular:*
                                    <input
                                        type="tel"
                                        name="celular"
                                        value={formValues.celular}
                                        onChange={handleInputChange}
                                    />
                                </label>
                            </div>
                            <div className="form-group">
                                <label>
                                    Localidad:*
                                    <select
                                        name="localidad"
                                        value={formValues.localidad}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Selecciona una localidad</option>
                                        {localidadesOptions.map((localidad, index) => (
                                            <option key={index} value={localidad.value}>
                                                {localidad.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            
                            <h4>Miembros del Equipo</h4>
                            
                            {jugadores.map((jugador, index) => (
                                <div key={index} className="jugador-container">
                                    <h5>Jugador {index + 1}</h5>
                                    <div className="form-group">
                                        <label>
                                            Nombre:*
                                            <input
                                                type="text"
                                                value={jugador.nombre}
                                                onChange={(e) => handleJugadorChange(index, "nombre", e.target.value)}
                                            />
                                        </label>
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Apellido:*
                                            <input
                                                type="text"
                                                value={jugador.apellido}
                                                onChange={(e) => handleJugadorChange(index, "apellido", e.target.value)}
                                            />
                                        </label>
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
                                            Email:
                                            <input
                                                type="email"
                                                value={jugador.email}
                                                onChange={(e) => handleJugadorChange(index, "email", e.target.value)}
                                            />
                                        </label>
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Celular:*
                                            <input
                                                type="tel"
                                                value={jugador.celular}
                                                onChange={(e) => handleJugadorChange(index, "celular", e.target.value)}
                                            />
                                        </label>
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
                                className="add-button"
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

                            <button type="submit" className="main-button">
                                Inscribir Equipo
                            </button>
                        </form>
                    </div>
                </main>
            )}
        </>
    );
};
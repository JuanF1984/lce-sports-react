import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import supabase from "../../utils/supabase";

import { LogoNeon } from '../common/LogoNeon';

import { useAuth } from "../../context/UseAuth";

import { useProximoEvento } from "../../hooks/useProximoEvento";

import { useGames } from "../../hooks/useGames";

import { localidadesBuenosAires } from "../../data/localidades";


import '../../styles/Formulario.css';

export const Formulario = () => {
    const navigate = useNavigate();
    const { user, isLoading } = useAuth();
    const [formValues, setFormValues] = useState({
        nombre: "",
        apellido: "",
        edad: "",
        email: "",
        celular: "",
        localidad: "",
    });
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [showLoading, setShowLoading] = useState(false);
    const { proximoEvento, fecha_inicio, fecha_fin, localidad, loading } = useProximoEvento();
    const { games, loading: loadingGames, error: errorGames } = useGames();
    const [selectedGames, setSelectedGames] = useState([]);

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

    const handleCheckboxChange = (gameId) => {
        setSelectedGames((prev) =>
            prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]

        );
    };

    const handleModalAccept = () => {
        setSuccessMessage("");
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        const { nombre, apellido, celular, localidad } = formValues;

        // Validaciones
        if (!nombre || !apellido || !celular || !localidad) {
            setErrorMessage("Por favor, completa todos los campos obligatorios.");
            return;
        }

        if (selectedGames.length === 0) {
            setErrorMessage("Por favor, selecciona al menos un juego.");
            return;
        }

        try {
            // Insertar en la tabla inscriptions y obtener los datos insertados
            const { data: inscriptionData, error: insertError } = await supabase
                .from("inscriptions")
                .insert({
                    user_id: user.id,
                    ...formValues,
                    id_evento: proximoEvento.id,
                })
                .select() // Agregamos .select() para obtener los datos insertados
                .single();

            if (insertError) {
                throw insertError;
            }

            if (!inscriptionData) {
                throw new Error("No se recibieron datos de la inscripción.");
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

        } catch (err) {
            setErrorMessage("Hubo un error al procesar tu solicitud. Intenta nuevamente.");
            console.error("Error:", err);
        }
    };

    return (
        <>
            {showLoading ?
                (<LogoNeon onClose={() => setShowLoading(false)} />
                ) : (
                    <main>
                        <div className="form-container">
                            <h3>Formulario Inscripción al Torneo</h3>
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
                                    <label>Juegos:*</label>

                                    {loadingGames && <p>Cargando juegos...</p>}
                                    {errorGames && <p>Error al cargar juegos: {errorGames}</p>}

                                    <div className="checkbox-grid">
                                        {!loadingGames && !errorGames && games.length > 0 ? (

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
                                            !loadingGames && !errorGames && <p>No hay juegos disponibles.</p>
                                        )}
                                    </div>
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
                                {errorMessage && (
                                    <p className="error-message">{errorMessage}</p>
                                )}
                                {successMessage && (

                                    <div className="modal-insc-overlay">
                                        <div className="modal-insc-content">
                                            <h3>¡Registro exitoso!</h3>
                                            <p>
                                                Se registró correctamente al torneo. Ante cualquier duda, comuníquese al
                                                celular (011) 1234-5678.
                                            </p>
                                            <button onClick={handleModalAccept}>Aceptar</button>
                                        </div>
                                    </div>
                                )}

                                <button type="submit" className="main-button">
                                    Enviar inscripción
                                </button>
                            </form>

                        </div>
                    </main>
                )}
        </>
    )
}

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import supabase from "../../utils/supabase";

import { LogoNeon } from '../common/LogoNeon';

import { useAuth } from "../../context/UseAuth";

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
        juegos: [],
        localidad: "",
    });
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [showLoading, setShowLoading] = useState(false);

    const staticData = {
        fecha: "2025-01-15 al 2025-01-16",
        lugar: "Gaming Center, Buenos Aires",
    };

    const juegos = [
        { id: "cs", label: "Counter Strike", value: "Counter Strike" },
        { id: "valorant", label: "Valorant", value: "Valorant" },
        { id: "fifa", label: "FIFA", value: "FIFA" },
        { id: "f1", label: "F1", value: "F1" },
        { id: "lol", label: "League of Legends", value: "League of Legends" },
    ];

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

    const handleCheckboxChange = (e) => {
        const { value, checked } = e.target;
        setFormValues((prev) => {
            const juegos = checked
                ? [...prev.juegos, value]
                : prev.juegos.filter((juego) => juego !== value);
            return { ...prev, juegos };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        const { nombre, apellido, celular, juegos, localidad } = formValues;

        if (!nombre || !apellido || !celular || !juegos.length || !localidad) {
            setErrorMessage("Por favor, completa todos los campos obligatorios.");
            return;
        }

        try {
            const { error } = await supabase.from("inscriptions").insert({
                user_id: user.id,
                ...formValues,
                fecha: staticData.fecha,
                lugar: staticData.lugar,
            });

            if (error) throw error;

            setSuccessMessage("Inscripción realizada con éxito.");
            setFormValues({
                nombre: "",
                apellido: "",
                edad: "",
                email: "",
                celular: "",
                juegos: [],
                localidad: "",
            });
        } catch (err) {
            console.error("Error al guardar en la base de datos:", err.message);
            setErrorMessage("Hubo un error al procesar tu solicitud. Intenta nuevamente.");
        }
    };

    return (
        <>
            {showLoading ?
                (<LogoNeon onClose={()=>setShowLoading(false)}/>
                ) : (
                    <main>
                        <div className="form-container">
                            <h3>Formulario Inscripción al Torneo</h3>
                            <div className="info-text">
                                <p>Fecha del torneo: {staticData.fecha}</p>
                                <p>Lugar: {staticData.lugar}</p>
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
                                    <div className="checkbox-grid">
                                        {juegos.map((juego) => (
                                            <label key={juego.id} className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    value={juego.value}
                                                    checked={formValues.juegos.includes(juego.value)}
                                                    onChange={handleCheckboxChange}
                                                />
                                                {juego.label}
                                            </label>
                                        ))}
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
                                    // <p className="success-message">{successMessage}</p>
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

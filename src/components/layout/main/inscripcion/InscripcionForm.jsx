// InscripcionForm.jsx
import React, { useState, useEffect } from "react";
import supabase from "../../../../utils/supabase";
import { AuthModal } from "../../header/AuthModalP";

const TournamentRegistration = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userId, setUserId] = useState(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [formValues, setFormValues] = useState({
        nombre: "",
        apellido: "",
        email: "",
        celular: "",
        juegos: [],
        localidad: "",
    });
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    
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

    const localidades = [
        { value: "Buenos Aires", label: "Buenos Aires" },
        { value: "La Plata", label: "La Plata" },
        { value: "Mar del Plata", label: "Mar del Plata" },
        { value: "Bahía Blanca", label: "Bahía Blanca" },
        { value: "Tandil", label: "Tandil" },
    ];

    useEffect(() => {
        const checkAuthStatus = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;
                setIsAuthenticated(!!session);
                setUserId(session?.user?.id || null);
            } catch (err) {
                console.error("Error checking auth status:", err.message);
            }
        };

        const { subscription } = supabase.auth.onAuthStateChange((event, session) => {
            setIsAuthenticated(!!session);
            setUserId(session?.user?.id || null);
        });

        checkAuthStatus();

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

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
                user_id: userId,
                ...formValues,
                fecha: staticData.fecha,
                lugar: staticData.lugar,
            });

            if (error) throw error;

            setSuccessMessage("Inscripción realizada con éxito.");
            setFormValues({
                nombre: "",
                apellido: "",
                email: "",
                celular: "",
                juegos: [],
                localidad: "",
            });
            setShowFormModal(false);
        } catch (err) {
            console.error("Error al guardar en la base de datos:", err.message);
            setErrorMessage("Hubo un error al procesar tu solicitud. Intenta nuevamente.");
        }
    };

    return (
        <div className="container-form">
            {/* <LogIn /> */}

            <button
                className="inscribirse-btn"
                onClick={() => {
                    if (isAuthenticated) {
                        setShowFormModal(true);
                    } else {
                        setShowAuthModal(true);
                    }
                }}
            >
                Inscribirse al torneo
            </button>

            {showFormModal && (
                <div className="modal-form-overlay">
                    <div className="modal-form">
                        <div className="modal-form-header">
                            <h2>Formulario de inscripción</h2>
                            <button
                                className="close-btn"
                                onClick={() => setShowFormModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="form">
                            <div className="form-grid">
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
                                        {localidades.map((localidad) => (
                                            <option key={localidad.value} value={localidad.value}>
                                                {localidad.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="info-text">
                                <p>Fecha del torneo: {staticData.fecha}</p>
                                <p>Lugar: {staticData.lugar}</p>
                            </div>

                            {errorMessage && (
                                <p className="error-message">{errorMessage}</p>
                            )}
                            {successMessage && (
                                <p className="success-message">{successMessage}</p>
                            )}

                            <button type="submit" className="submit-btn">
                                Enviar inscripción
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showAuthModal && (
                <AuthModal
                    onClose={() => setShowAuthModal(false)}
                />
            )}
        </div>
    );
};

export default TournamentRegistration;

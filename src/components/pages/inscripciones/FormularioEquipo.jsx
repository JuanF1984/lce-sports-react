import { useEffect } from "react";
import { EventoInfo } from "./common/EventoInfo";
import { useNavigate } from "react-router-dom";
import supabase from "../../../utils/supabase";
import { LogoNeon } from '../../common/LogoNeon';
import { useAuth } from "../../../context/UseAuth";
import { useEventGames } from "../../../hooks/useEventGames";
import { localidadesBuenosAires } from "../../../data/localidades";
import { enviarConfirmacionEquipo } from "../../../utils/emailService";
import { generateQRString } from "../../../utils/qrCodeGenerator";
import { useEventoSeleccionado } from "./hooks/useEventoSeleccionado";
import { useFormularioEquipo } from "../../../hooks/useFormularioEquipo";
import { capitalizeText, normalizeEmail } from "../../../utils/validations";

export const FormularioEquipo = ({ onBack, eventoId }) => {
    const navigate = useNavigate();
    const { user, isLoading } = useAuth();

    // Usar el hook useEventoSeleccionado
    const {
        eventoSeleccionado,
        loadingEvento,
        errorMessage: eventoErrorMessage
    } = useEventoSeleccionado(eventoId);

    // Usar el hook useEventGames
    const {
        eventGames,
        loading: loadingGames,
        error: errorGames
    } = useEventGames(
        eventoSeleccionado ? [eventoSeleccionado.id] : []
    );

    // Filtrar juegos de equipo
    const juegosEquipo = eventoSeleccionado?.id ?
        (eventGames[eventoSeleccionado.id] || []).filter(game => game.team_option) :
        [];

    // Usar el hook useFormularioEquipo
    const {
        formValues,
        setFormValues,
        fieldErrors,
        setFieldErrors,
        jugadores,
        setJugadores,
        jugadoresErrors,
        setJugadoresErrors,
        selectedGame,
        setSelectedGame,
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
        handleInputChange,
        handleJugadorChange,
        handleGameChange,
        addJugador,
        removeJugador,
        validateForm,
        resetForm
    } = useFormularioEquipo();

    const localidadesOptions = localidadesBuenosAires.map((localidad) => ({
        value: localidad,
        label: localidad,
    }));

    // Manejar estado de carga
    useEffect(() => {
        if (isLoading) {
            setShowLoading(true);
        } else {
            setShowLoading(false); // Si hay usuario, ocultar el loading.
        }
    }, [isLoading, setShowLoading]);

    const handleModalAccept = () => {
        setSuccessMessage("");
        window.location.assign("https://www.instagram.com/lcesports/");
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setFormSubmitted(true);
        setErrorMessage("");

        if (!eventoSeleccionado || !eventoSeleccionado.id) {
            setErrorMessage("No se ha seleccionado ningún evento válido.");
            setIsSaving(false);
            return;
        }

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
            // Normalizar los datos del capitán
            const normalizedFormValues = {
                ...formValues,
                nombre: capitalizeText(formValues.nombre),
                apellido: capitalizeText(formValues.apellido),
                email: normalizeEmail(formValues.email),
            };

            // 1. Inscribir al capitán
            const { data: capitanData, error: capitanError } = await supabase
                .from("inscriptions")
                .insert({
                    ...(user ? { user_id: user.id } : {}),
                    ...normalizedFormValues,
                    id_evento: eventoSeleccionado.id,
                    team_name: normalizedFormValues.team_name
                })
                .select()
                .single();

            if (capitanError) {
                throw capitanError;
            }

            // Asegurarse de que capitanData tenga el id_evento para el QR
            const capitanDataCompleto = {
                ...capitanData,
                id_evento: eventoSeleccionado.id // Aseguramos que tenga el id_evento
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
            capitanData.id_evento = eventoSeleccionado.id; // Aseguramos que tenga el id_evento

            // Array para almacenar los datos de todos los jugadores con sus QRs
            const jugadoresConQR = [];

            // 3. Inscribir a cada jugador adicional
            for (let i = 0; i < jugadores.length; i++) {
                const jugador = jugadores[i];

                // Normalizar datos del jugador
                const jugadorNormalizado = {
                    ...jugador,
                    nombre: capitalizeText(jugador.nombre),
                    apellido: capitalizeText(jugador.apellido),
                    email: jugador.email ? normalizeEmail(jugador.email) : null,
                };

                // Crear inscripción para el jugador
                const { data: jugadorData, error: jugadorError } = await supabase
                    .from("inscriptions")
                    .insert({
                        ...(user ? { user_id: user.id } : {}),
                        nombre: jugadorNormalizado.nombre,
                        apellido: jugadorNormalizado.apellido,
                        edad: jugadorNormalizado.edad || null,
                        email: jugadorNormalizado.email || null,
                        celular: jugadorNormalizado.celular,
                        localidad: normalizedFormValues.localidad, // Misma localidad que el capitán
                        id_evento: eventoSeleccionado.id,
                        team_name: normalizedFormValues.team_name // Mismo nombre de equipo
                    })
                    .select()
                    .single();

                if (jugadorError) {
                    throw jugadorError;
                }

                // Asegurarse de que jugadorData tenga el id_evento para el QR
                const jugadorDataCompleto = {
                    ...jugadorData,
                    id_evento: eventoSeleccionado.id
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
                    ...jugadorNormalizado,
                    id: jugadorData.id,
                    id_evento: eventoSeleccionado.id,
                    qr_code: qrStringJugador
                });
            }

            const juegoSeleccionado = juegosEquipo.find(game => game.id === selectedGame);

            // Si el capitán tiene email, enviar confirmación
            if (normalizedFormValues.email) {
                try {
                    await enviarConfirmacionEquipo(
                        capitanData, // datos del capitán con QR
                        jugadoresConQR,  // datos de los jugadores con QRs
                        {
                            nombre: eventoSeleccionado.nombre,
                            fecha_inicio: eventoSeleccionado.fecha_inicio,
                            hora_inicio: eventoSeleccionado.hora_inicio,
                            localidad: eventoSeleccionado.localidad,
                            direccion: eventoSeleccionado.direccion,
                        },
                        juegoSeleccionado,
                        normalizedFormValues.team_name
                    );
                } catch (emailError) {
                    console.error("Error al enviar confirmación por email:", emailError);
                }
            }

            // Limpiar el formulario y mostrar mensaje de éxito
            setSuccessMessage("Inscripción de equipo realizada con éxito.");
            resetForm(); // Utilizamos la función del hook para resetear el formulario

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

                        <EventoInfo evento={eventoSeleccionado} loading={loadingEvento} />

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
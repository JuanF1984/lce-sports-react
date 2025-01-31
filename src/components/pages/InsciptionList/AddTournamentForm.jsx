import { useState } from 'react'

// Importación de Supabase
import supabase from '../../../utils/supabase'

// Importación del nombre de las localidades de la Provincia de Buenos Aires
import { localidadesBuenosAires } from '../../../data/localidades'

// Importación del hook useGames para ver los juegos que están cargados en la base de datos
import { useGames } from '../../../hooks/useGames'

export const AddTournamentForm = () => {
    // Valores del formulario
    const [formValues, setFormValues] = useState({
        fecha_inicio: "",
        fecha_fin: "",
        localidad: ""
    })
    // Valores para usar en el select de localidales
    const localidadesOptions = localidadesBuenosAires.map((localidad) => ({
        value: localidad,
        label: localidad
    }))
    // Valores de la importación del Hook de Games
    const { games, loading: loadingGames, error: errorGames } = useGames();

    // Variable donde se van a guardar los datos del checkbox de juegos
    const [selectedGames, setSelectedGames] = useState([]);

    // Variables para mensajes de error y éxito
    const [successMessage, setSuccessMessage] = useState("")
    const [errorMessage, setErrorMessage] = useState("")

    // CallBack para cambiar estado de los checkbox
    const handleCheckboxChange = (gameId) => {
        setSelectedGames((prev) =>
            prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]

        );
    };

    // CallBack para cambiar estado de los input
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormValues((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        const { fecha_inicio, fecha_fin, localidad } = formValues

        if (!fecha_inicio || !fecha_fin || !localidad) {
            setErrorMessage("Por favor completar todos los campos")
            return
        }

        if (selectedGames.length === 0) {
            setErrorMessage("Por favor, selecciona al menos un juego.");
            return;
        }

        // intentar guardar los datos
        try {
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .insert({
                    ...formValues
                })
                .select() //  .select() para obtener los datos insertados
                .single();

            if (eventError) {
                throw eventError
            }

            if (!eventData) {
                throw new Error("No se recibieron datos.")
            }

            if (selectedGames.length > 0) {
                const gameInscriptions = selectedGames.map(gameId => ({
                    game_id: gameId,
                    event_id: eventData.id,
                }));

                const { error: gameInsertError } = await supabase
                    .from("event_games")
                    .insert(gameInscriptions);

                if (gameInsertError) {
                    console.error(gameInsertError)
                    throw gameInsertError;
                }
            }

            // Limpiar el formulario y mostrar mensaje de éxito
            setSuccessMessage("Inscripción realizada con éxito.");
            setFormValues({
                fecha_inicio: "",
                fecha_fin: "",
                localidad: ""
            });
            setSelectedGames([]);
        }
        catch (err) {
            setErrorMessage("Hubo un error al procesar tu solicitud. Intenta nuevamente.");
            console.error("Error:", err);
        }
    }

    return (
        <div className="filters-container">
            <h3>Nuevo Torneo</h3>
            <form onSubmit={handleSubmit}>

                {/* Fecha de inicio del torneo */}
                <div className="filter-group">
                    <label className="filter-label">
                        Fecha de inicio:*
                        <input
                            type="date"
                            name="fecha_inicio"
                            value={formValues.fecha_inicio}
                            onChange={handleInputChange}
                            className="filter-date"
                        />
                    </label>
                </div>

                {/* Fecha de finalización del torneo */}
                <div className="filter-group">
                    <label className="filter-label">
                        Fecha de finalización:*
                        <input
                            type="date"
                            name="fecha_fin"
                            value={formValues.fecha_fin}
                            onChange={handleInputChange}
                            className="filter-date"
                        />
                    </label>
                </div>

                {/* Localidad */}
                <div className="filter-group">
                    <label className="filter-label">
                        Localidad:*
                        <select
                            name="localidad"
                            value={formValues.localidad}
                            onChange={handleInputChange}
                            className="filter-select"
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

                {/* Juegos disponibles */}
                <div className="filter-group">
                    <label className="filter-label">Juegos:*</label>
                    {loadingGames && <p>Cargando juegos...</p>}
                    {errorGames && <p className="error-message">Error al cargar juegos: {errorGames}</p>}

                    <div className="checkbox-grid">
                        {!loadingGames && !errorGames && games.length > 0 ? (
                            games.map((game) => (
                                <label key={game.id} className="checkbox-label">
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

                {errorMessage && (
                    <p className="error-message-admin">{errorMessage}</p>
                )}

                {successMessage && (
                    <p className="success-message-admin">{successMessage}</p>
                )}

                <button type="submit" className="export-button">
                    Guardar torneo
                </button>
            </form>
        </div>

    )
}

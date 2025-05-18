import { useState } from 'react';
import { validateEmail, validatePhone, validateAge } from '../utils/validations';

export const useFormularioEquipo = (initialValues = {}) => {
    // Estado del formulario principal (capitán)
    const [formValues, setFormValues] = useState({
        nombre: "",
        apellido: "",
        edad: "",
        email: "",
        celular: "",
        localidad: "",
        team_name: "",
        ...initialValues
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

    // Estado para jugadores
    const [jugadores, setJugadores] = useState([
        { nombre: "", apellido: "", edad: "", celular: "", email: "" }
    ]);

    // Estado para errores de jugadores
    const [jugadoresErrors, setJugadoresErrors] = useState([
        { nombre: false, apellido: false, celular: false, celularFormat: false, email: false, emailFormat: false, edad: false, edadFormat: false }
    ]);

    // Estado para juego seleccionado
    const [selectedGame, setSelectedGame] = useState("");

    // Estados generales del formulario
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [showLoading, setShowLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);

    // Función para manejar cambios en los inputs del capitán
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
            } else if (name === 'edad') {
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

    // Función para manejar cambios en los datos de jugadores
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

    // Función para manejar cambios en la selección de juego
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

    // Funciones para agregar y quitar jugadores
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

    // Función para validar el formulario completo
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

    // Función para reiniciar el formulario
    const resetForm = () => {
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
    };

    return {
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
    };
};
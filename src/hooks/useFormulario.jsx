import { useState } from 'react';
import { validateEmail, validatePhone, validateAge } from '../utils/validations';
export const useFormulario = (initialValues = {}) => {
    const [formValues, setFormValues] = useState({
        nombre: "",
        apellido: "",
        edad: "",
        email: "",
        celular: "",
        localidad: "",
        ...initialValues
    });

    const [fieldErrors, setFieldErrors] = useState({
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

    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [showLoading, setShowLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);

    // Manejar cambios en los inputs con validación específica para edad
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

    // Función para validar el formulario
    const validateForm = (selectedGames = []) => {
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
            selectedGames: selectedGames.length === 0
        };

        setFieldErrors(newFieldErrors);

        // Verificar si hay algún error en el formulario
        const hasErrors = Object.values(newFieldErrors).some(error => error);

        return !hasErrors;
    };

    return {
        formValues,
        setFormValues,
        fieldErrors,
        setFieldErrors,
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
        validateForm
    };
};
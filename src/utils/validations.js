// Validar email
export const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

// Validar teléfono
export const validatePhone = (phone) => {
    // Validar que sea numérico y tenga entre 8 y 15 dígitos
    const regex = /^\d{8,15}$/;
    return regex.test(phone);
};

// Validar que la edad sea solo números
export const validateAge = (age) => {
    const regex = /^\d+$/;  // Solo dígitos
    return regex.test(age);
};

// Función para capitalizar texto (que vi en tu código también)
export const capitalizeText = (text) => {
    if (!text) return '';

    // Dividir el texto por espacios, capitalizar cada palabra y volver a unir
    return text
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .filter(word => word) // Eliminar palabras vacías que podrían surgir de múltiples espacios
        .join(' ');
};

// Función para normalizar emails
export const normalizeEmail = (email) => {
    if (!email) return '';
    return email.trim().toLowerCase();
};
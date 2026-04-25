const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export function normalizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
}

export function validateEmail(rawEmail) {
    const normalized = normalizeEmail(rawEmail);

    if (!normalized) {
        return { valid: false, reason: 'Email vacío', normalized };
    }
    if (/[^\x00-\x7F]/.test(normalized)) {
        return {
            valid: false,
            reason: 'El email contiene caracteres no permitidos (tildes, eñes u otros). Verificá que esté escrito en caracteres simples.',
            normalized,
        };
    }
    if (!EMAIL_REGEX.test(normalized)) {
        return { valid: false, reason: 'Formato de email inválido', normalized };
    }
    return { valid: true, normalized };
}

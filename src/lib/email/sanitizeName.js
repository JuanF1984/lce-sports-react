export function sanitizeName(rawName) {
    if (!rawName || typeof rawName !== 'string') return 'Participante';
    const cleaned = rawName
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, '')
        .trim();
    return cleaned || 'Participante';
}

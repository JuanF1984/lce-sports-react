// Reglas de la Galería administrable (gallery_items). Ver docs/galeria.md.
//
// El límite de cantidad es SOLO validación de experiencia de usuario acá.
// La validación definitiva vive en Supabase (trigger sobre `gallery_items`,
// ver supabase/migrations/20260810_gallery_items.sql). Si el frontend
// dejara pasar una alta número 16 (bug, request directa, etc.), el trigger
// la rechaza igual — por eso el código de acá coincide 1 a 1 con el
// marcador que usa el trigger. Mismo patrón que
// src/utils/eventRules.js (mapSupabaseRuleError), pero para esta tabla.

export const GALLERY_MAX_ITEMS = 15;

const GALLERY_RULE_ERROR_MESSAGES = {
    GALLERY_ITEMS_LIMIT_EXCEEDED: `Se alcanzó el máximo de ${GALLERY_MAX_ITEMS} imágenes en la galería. Eliminá una imagen antes de agregar otra.`,
};

// Devuelve el mensaje específico si el error de Supabase coincide con el
// marcador conocido, o null si no se reconoce (para que quien llama aplique
// su propio mensaje genérico de fallback). No se expone nunca el error crudo
// de Postgres al admin.
export const mapGalleryRuleError = (error) => {
    if (!error) return null;
    const haystack = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
    for (const code of Object.keys(GALLERY_RULE_ERROR_MESSAGES)) {
        if (haystack.includes(code)) return GALLERY_RULE_ERROR_MESSAGES[code];
    }
    return null;
};

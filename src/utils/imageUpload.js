// Reglas compartidas de validación de imágenes antes de subir a Supabase
// Storage. Mismo criterio (formatos + 5 MB) que ya usaban GamesList.jsx y
// GalleryList.jsx de forma duplicada.
export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const validateImageFile = (file) => {
    if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type)) {
        return 'Formato no permitido. Subí una imagen JPG, PNG o WebP.';
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return 'El archivo supera el tamaño máximo permitido (5 MB).';
    }
    return null;
};

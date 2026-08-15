// Optimiza imágenes en el navegador antes de subirlas a Supabase Storage:
// redimensiona al lado más largo máximo y convierte siempre el resultado a
// WebP. Reduce tamaño en Storage y, sobre todo, Cached Egress.
//
// Se corre DESPUÉS de que el archivo original ya pasó validateImageFile()
// (formato + 5 MB) — esta utilidad no valida el archivo de entrada, solo lo
// procesa. Si algo falla acá, se debe abortar el upload (fail-safe): nunca
// subir el original como fallback silencioso.
//
// Dimensión máxima: 1600px de lado más largo, sin agrandar imágenes más
// chicas — suficiente para banners/cards/galería de este sitio sin pesar de
// más.
//
// Calidad WebP: 0.83 — dentro del rango 0.82–0.85 pedido, buen balance
// entre peso final y fidelidad visual a este tamaño máximo.
const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.83;
const OUTPUT_MIME = 'image/webp';

export class ImageOptimizationError extends Error {}

// createImageBitmap es la vía preferida (evita el roundtrip por <img> +
// Object URL), pero algunos navegadores/formatos pueden fallar al decodificar
// con ella (ej. ciertos PNG en Safari viejo) — se cae a <img> como fallback.
// `imageOrientation:'from-image'` respeta el tag EXIF de rotación de fotos
// tomadas con celular; el fallback por <img> lo respeta de por sí porque usa
// el pipeline normal de decode/render del navegador.
const loadImageSource = async (file) => {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
            // sigue al fallback de abajo
        }
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new ImageOptimizationError('No se pudo leer la imagen. Probá con otro archivo.'));
        };
        img.src = objectUrl;
    });
};

const getSourceDimensions = (source) => ({
    width: source.width ?? source.naturalWidth ?? 0,
    height: source.height ?? source.naturalHeight ?? 0,
});

// Nunca agranda: si el lado más largo ya entra dentro del máximo, devuelve
// las dimensiones originales tal cual.
const computeTargetSize = (width, height, maxDimension) => {
    const longestSide = Math.max(width, height);
    if (longestSide <= maxDimension) {
        return { width, height };
    }
    const scale = maxDimension / longestSide;
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
};

const withWebpExtension = (fileName) => {
    const dotIndex = fileName.lastIndexOf('.');
    const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    return `${base}.webp`;
};

/**
 * Redimensiona (si hace falta) y convierte una imagen a WebP, lista para
 * subir a Supabase Storage.
 *
 * @param {File} file - Archivo original, ya validado (formato/tamaño) por
 *   quien llama.
 * @param {{maxDimension?: number, quality?: number}} [options]
 * @returns {Promise<{file: File, meta: {
 *   originalSize: number, originalWidth: number, originalHeight: number,
 *   finalSize: number, finalWidth: number, finalHeight: number,
 *   reductionPercent: number,
 * }}>}
 * @throws {ImageOptimizationError} si la imagen no se pudo decodificar o
 *   convertir — quien llama NO debe subir el archivo original como fallback.
 */
export const optimizeImage = async (file, options = {}) => {
    const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
    const quality = options.quality ?? DEFAULT_QUALITY;

    const source = await loadImageSource(file);
    const { width, height } = getSourceDimensions(source);

    if (!width || !height) {
        source.close?.();
        throw new ImageOptimizationError('No se pudo determinar el tamaño de la imagen.');
    }

    const target = computeTargetSize(width, height, maxDimension);

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        source.close?.();
        throw new ImageOptimizationError('El navegador no pudo procesar la imagen.');
    }

    // Sin pintar ningún fondo antes de dibujar: el canvas arranca
    // transparente, así que el canal alpha de un PNG con transparencia se
    // conserva tal cual al convertir a WebP (que también soporta alpha) —
    // nunca se agrega un fondo blanco/negro accidental.
    ctx.drawImage(source, 0, 0, target.width, target.height);
    source.close?.(); // libera memoria si era un ImageBitmap

    const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, OUTPUT_MIME, quality);
    });

    // Fail-safe: si el navegador no puede generar WebP, algunos devuelven
    // null y otros caen silenciosamente a otro formato (ej. PNG) — en
    // cualquiera de los dos casos hay que abortar, nunca subir ese
    // resultado con extensión .webp mintiendo el contenido real.
    if (!blob || blob.type !== OUTPUT_MIME) {
        throw new ImageOptimizationError(
            'No se pudo convertir la imagen a WebP en este navegador. Probá con otro archivo o actualizá el navegador.'
        );
    }

    const optimizedFile = new File([blob], withWebpExtension(file.name), { type: OUTPUT_MIME });

    return {
        file: optimizedFile,
        meta: {
            originalSize: file.size,
            originalWidth: width,
            originalHeight: height,
            finalSize: optimizedFile.size,
            finalWidth: target.width,
            finalHeight: target.height,
            reductionPercent: file.size > 0
                ? Math.round((1 - optimizedFile.size / file.size) * 100)
                : 0,
        },
    };
};

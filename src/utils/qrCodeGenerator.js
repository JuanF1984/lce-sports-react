import QRCode from 'qrcode';

/**
 * Genera una URL única para el código QR basada en los datos de inscripción
 * @param {Object} inscriptionData - Datos de la inscripción
 * @param {String} baseUrl - URL base del sitio (ej: "https://tu-dominio.com")
 * @returns {string} - URL para generar el QR que registra asistencia
 */
export const generateQRString = (inscriptionData, baseUrl = window.location.origin) => {
  // Generamos un token único para la seguridad
  const uniqueToken = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  
  // Creamos una URL con los parámetros de asistencia
  return `${baseUrl}/verify-attendance/${inscriptionData.id_evento}/${inscriptionData.id}/${uniqueToken}`;
};

/**
 * Genera un código QR como una URL de datos (data URL)
 * @param {string} url - URL para generar el QR
 * @returns {Promise<string>} - Promise que resuelve con la data URL del código QR
 */
export const generateQRAsDataURL = async (url) => {
  try {
    const qrDataURL = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',  // Color del QR
        light: '#ffffff'  // Color de fondo
      }
    });
    return qrDataURL;
  } catch (err) {
    console.error('Error al generar código QR:', err);
    throw err;
  }
};
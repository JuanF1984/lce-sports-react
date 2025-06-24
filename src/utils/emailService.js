import emailjs from '@emailjs/browser'
import { getFAQsHtmlForEmail } from './faqEmail'
import { generateQRString, generateQRAsDataURL } from './qrCodeGenerator'
import supabase from './supabase' 

// Configurar con tus credenciales de EmailJS
const EMAIL_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const EMAIL_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const EMAIL_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

/**
 * Envía un correo de confirmación de inscripción individual sin código QR
 * @param {Object} inscripcion - Datos de la inscripción
 * @param {Object} evento - Datos del evento
 * @param {Array} juegos - Nombres de los juegos seleccionados
 * @returns {Promise} - Promesa con respuesta del envío
 */
export const enviarConfirmacionIndividual = async (inscripcion, evento, juegos) => {
    // 1. Generar la URL única para el QR (mantener para base de datos)
    const qrUrl = generateQRString(inscripcion);

    // 2. Guardar la URL en la base de datos (mantener para posible uso futuro)
    try {
        const { error } = await supabase
            .from("inscriptions")
            .update({
                qr_code: qrUrl,
                asistencia: false
            })
            .eq("id", inscripcion.id);

        if (error) {
            console.error("Error al guardar código QR en la base de datos:", error);
        }
    } catch (dbError) {
        console.error("Error de conexión con la base de datos:", dbError);
    }

    // 3. Prepara los datos de juegos para el email
    let juegosTexto = '';
    // Asegurarse de que juegos sea un array y convertirlo a string
    if (Array.isArray(juegos)) {
        juegosTexto = juegos.join(', ');
    } else if (typeof juegos === 'string') {
        juegosTexto = juegos;
    } else if (juegos && typeof juegos === 'object') {
        // Intenta extraer nombres de juegos si es un objeto complejo
        juegosTexto = Object.values(juegos)
            .filter(val => val && typeof val === 'string')
            .join(', ');
    }

    // 4. Generar HTML de FAQs específicas para estos juegos
    const faqsHtml = getFAQsHtmlForEmail(juegos);

    // 5. Configurar parámetros para la plantilla de email (sin QR)
    const templateParams = {
        to_email: inscripcion.email || '',
        to_name: `${inscripcion.nombre || ''} ${inscripcion.apellido || ''}`,
        evento_fecha: evento.fecha_inicio || '',
        evento_lugar: evento.localidad || '',
        evento_hora: evento.hora_inicio || '',
        juegos_lista_texto: juegosTexto,
        faqs_html: faqsHtml, // Añadir las FAQs como HTML
        qr_code_html: ''  // HTML vacío para el QR
    };

    // 6. Enviar el email usando EmailJS
    return emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        templateParams,
        EMAIL_PUBLIC_KEY
    );
};

/**
 * Envía correos de confirmación para inscripción de equipo sin códigos QR
 * @param {Object} capitan - Datos del capitán
 * @param {Array} jugadores - Datos de los jugadores
 * @param {Object} evento - Datos del evento
 * @param {Object} juego - Datos del juego seleccionado
 * @param {String} nombreEquipo - Nombre del equipo
 * @returns {Promise} - Promesa con respuesta del envío al capitán
 */
export const enviarConfirmacionEquipo = async (capitan, jugadores, evento, juego, nombreEquipo) => {
    // 1. Generar URL única para el QR del capitán (mantener para base de datos)
    const qrUrlCapitan = generateQRString(capitan);

    // 2. Guardar la URL del capitán en la base de datos (mantener para posible uso futuro)
    try {
        const { error } = await supabase
            .from("inscriptions")
            .update({
                qr_code: qrUrlCapitan,
                asistencia: false
            })
            .eq("id", capitan.id);

        if (error) {
            console.error("Error al guardar código QR del capitán:", error);
        }
    } catch (dbError) {
        console.error("Error de conexión con la base de datos:", dbError);
    }

    // 3. Extraer el nombre del juego como string
    let juegoTexto = '';
    if (typeof juego === 'string') {
        juegoTexto = juego;
    } else if (juego && juego.game_name) {
        juegoTexto = juego.game_name;
    } else if (juego) {
        // Intenta extraer un nombre de cualquier propiedad disponible
        const propiedades = Object.values(juego).filter(val => val && typeof val === 'string');
        juegoTexto = propiedades.length > 0 ? propiedades[0] : 'Juego seleccionado';
    }

    // 4. Generar HTML de FAQs específicas para este juego
    const faqsHtml = getFAQsHtmlForEmail([juegoTexto]);

    // 5. Asegurarse de que los miembros del equipo sean un array
    const jugadoresArray = Array.isArray(jugadores) ? jugadores : [];

    // 6. Información adicional para incluir en el correo
    const infoEquipo = `Equipo: ${nombreEquipo || 'Sin nombre'}`;

    // 7. Crear parámetros para el template del email del capitán (sin QR)
    const templateParamsCapitan = {
        to_email: capitan.email || '',
        to_name: `${capitan.nombre || ''} ${capitan.apellido || ''}`,
        evento_fecha: evento?.fecha_inicio || '',
        evento_lugar: evento?.localidad || '',
        evento_hora: evento.hora_inicio || '',
        juegos_lista_texto: `${juegoTexto} (${infoEquipo})`,
        faqs_html: faqsHtml, // Añadir las FAQs como HTML
        qr_code_html: '' // HTML vacío para el QR
    };

    // 8. Enviar correo al capitán
    const resultadoCapitan = await emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        templateParamsCapitan,
        EMAIL_PUBLIC_KEY
    );

    // 9. Enviar correos a todos los demás miembros del equipo que tengan email
    const promesasJugadores = jugadoresArray
        .filter(jugador => jugador.email) // Solo a los que tienen email
        .map(async jugador => {
            // Generar QR único para cada jugador (mantener para base de datos)
            const qrUrlJugador = generateQRString(jugador);

            // Guardar QR del jugador en la base de datos (mantener para posible uso futuro)
            try {
                await supabase
                    .from("inscriptions")
                    .update({
                        qr_code: qrUrlJugador,
                        asistencia: false
                    })
                    .eq("id", jugador.id);
            } catch (error) {
                console.error(`Error al guardar QR para jugador ${jugador.nombre}:`, error);
            }

            const templateParamsJugador = {
                to_email: jugador.email || '',
                to_name: `${jugador.nombre || ''} ${jugador.apellido || ''}`,
                evento_fecha: evento?.fecha_inicio || '',
                evento_lugar: evento?.localidad || '',
                evento_hora: evento.hora_inicio || '',
                juegos_lista_texto: `${juegoTexto} (${infoEquipo} - Capitán: ${capitan.nombre || ''} ${capitan.apellido || ''})`,
                faqs_html: faqsHtml, // Añadir las FAQs como HTML
                qr_code_html: '' // HTML vacío para el QR
            };

            return emailjs.send(
                EMAIL_SERVICE_ID,
                EMAIL_TEMPLATE_ID,
                templateParamsJugador,
                EMAIL_PUBLIC_KEY
            );
        });

    // 10. Enviar todos los correos en paralelo, pero no esperar a que terminen
    Promise.all(promesasJugadores).catch(error => {
        console.error('Error enviando emails a jugadores:', error);
    });

    // 11. Devolver el resultado del envío al capitán
    return resultadoCapitan;
};
import emailjs from '@emailjs/browser'
import { getFAQsHtmlForEmail } from './faqEmail'

// Configurar con tus credenciales de EmailJS
const EMAIL_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const EMAIL_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const EMAIL_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

/**
 * Envía un correo de confirmación de inscripción individual
 * @param {Object} inscripcion - Datos de la inscripción
 * @param {Object} evento - Datos del evento
 * @param {Array} juegos - Nombres de los juegos seleccionados
 * @returns {Promise} - Promesa con respuesta del envío
 */
export const enviarConfirmacionIndividual = async (inscripcion, evento, juegos) => {
    let juegosTexto = ''
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


    // Generar HTML de FAQs específicas para estos juegos
    const faqsHtml = getFAQsHtmlForEmail(juegos);

    const templateParams = {
        to_email: inscripcion.email || '',
        to_name: `${inscripcion.nombre || ''} ${inscripcion.apellido || ''}`,
        evento_fecha: evento.fecha_inicio || '',
        evento_lugar: evento.localidad || '',
        evento_hora: evento.hora_inicio || '',
        juegos_lista_texto: juegosTexto,
        faqs_html: faqsHtml // Añadir las FAQs como HTML
    };


    return emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        templateParams,
        EMAIL_PUBLIC_KEY
    );
};

/**
 * Envía correos de confirmación para inscripción de equipo
 * @param {Object} capitan - Datos del capitán
 * @param {Array} jugadores - Datos de los jugadores
 * @param {Object} evento - Datos del evento
 * @param {Object} juego - Datos del juego seleccionado
 * @param {String} nombreEquipo - Nombre del equipo
 * @returns {Promise} - Promesa con respuesta del envío al capitán
 */
export const enviarConfirmacionEquipo = async (capitan, jugadores, evento, juego, nombreEquipo) => {
    // Extraer el nombre del juego como string
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

  
    // Generar HTML de FAQs específicas para este juego
    const faqsHtml = getFAQsHtmlForEmail([juegoTexto]);

    // Asegurarse de que los miembros del equipo sean un array
    const jugadoresArray = Array.isArray(jugadores) ? jugadores : [];

    // Información adicional para incluir en el correo
    const infoEquipo = `Equipo: ${nombreEquipo || 'Sin nombre'}`;

    // Crear parámetros para el template
    const templateParamsCapitan = {
        to_email: capitan.email || '',
        to_name: `${capitan.nombre || ''} ${capitan.apellido || ''}`,
        evento_fecha: evento?.fecha_inicio || '',
        evento_lugar: evento?.localidad || '',
        evento_hora: evento.hora_inicio || '',
        juegos_lista_texto: `${juegoTexto} (${infoEquipo})`,
        faqs_html: faqsHtml // Añadir las FAQs como HTML
    };

    
    // Enviar correo al capitán
    const resultadoCapitan = await emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        templateParamsCapitan,
        EMAIL_PUBLIC_KEY
    );

    // Enviar correos a todos los demás miembros del equipo que tengan email
    const promesasJugadores = jugadoresArray
        .filter(jugador => jugador.email) // Solo a los que tienen email
        .map(jugador => {
            const templateParamsJugador = {
                to_email: jugador.email || '',
                to_name: `${jugador.nombre || ''} ${jugador.apellido || ''}`,
                evento_fecha: evento?.fecha_inicio || '',
                evento_lugar: evento?.localidad || '',
                evento_hora: evento.hora_inicio || '',
                juegos_lista_texto: `${juegoTexto} (${infoEquipo} - Capitán: ${capitan.nombre || ''} ${capitan.apellido || ''})`,
                faqs_html: faqsHtml // Añadir las FAQs como HTML
            };


            return emailjs.send(
                EMAIL_SERVICE_ID,
                EMAIL_TEMPLATE_ID,
                templateParamsJugador,
                EMAIL_PUBLIC_KEY
            );
        });

    // Enviar todos los correos en paralelo, pero no esperar a que terminen
    Promise.all(promesasJugadores).catch(error => {
        console.error('Error enviando emails a jugadores:', error);
    });

    // Devolver el resultado del envío al capitán
    return resultadoCapitan;
};
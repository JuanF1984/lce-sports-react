import emailjs from '@emailjs/browser'
import { getFAQsHtmlForEmail } from './faqEmail'
import { generateQRString, generateQRAsDataURL } from './qrCodeGenerator'
import supabase from './supabase' 

// Configurar con tus credenciales de EmailJS
const EMAIL_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const EMAIL_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const EMAIL_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

/**
 * Envía un correo de confirmación de inscripción individual con código QR
 * @param {Object} inscripcion - Datos de la inscripción
 * @param {Object} evento - Datos del evento
 * @param {Array} juegos - Nombres de los juegos seleccionados
 * @returns {Promise} - Promesa con respuesta del envío
 */
export const enviarConfirmacionIndividual = async (inscripcion, evento, juegos) => {
    // 1. Generar la URL única para el QR
    const qrUrl = generateQRString(inscripcion);

    // 2. Guardar la URL en la base de datos
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

    // 3. Generar el código QR como data URL para incluirlo en el email
    let qrDataUrl = '';
    try {
        qrDataUrl = await generateQRAsDataURL(qrUrl);
    } catch (qrError) {
        console.error("Error al generar QR como data URL:", qrError);
    }

    // 4. Prepara los datos de juegos para el email
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

    // 5. Generar HTML de FAQs específicas para estos juegos
    const faqsHtml = getFAQsHtmlForEmail(juegos);

    // 6. Crear HTML para el QR que se incluirá en el email
    const qrHtml = qrDataUrl ? `
    <div style="margin: 30px 0; text-align: center;">
        <h3 style="margin-bottom: 10px;">Tu código QR de asistencia:</h3>
        <p style="margin-bottom: 15px;">Mostra este <strong> código QR </strong> al llegar al evento para registrar tu asistencia.</p>
        <img src="${qrDataUrl}" alt="Código QR" style="max-width: 200px; height: auto; margin-bottom: 10px;" />
        
    </div>` : '';

    // 7. Configurar parámetros para la plantilla de email
    const templateParams = {
        to_email: inscripcion.email || '',
        to_name: `${inscripcion.nombre || ''} ${inscripcion.apellido || ''}`,
        evento_fecha: evento.fecha_inicio || '',
        evento_lugar: evento.localidad || '',
        evento_hora: evento.hora_inicio || '',
        juegos_lista_texto: juegosTexto,
        faqs_html: faqsHtml, // Añadir las FAQs como HTML
        qr_code_html: qrHtml  // Añadir el QR como HTML
    };

    // 8. Enviar el email usando EmailJS
    return emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        templateParams,
        EMAIL_PUBLIC_KEY
    );
};

/**
 * Envía correos de confirmación para inscripción de equipo con códigos QR
 * @param {Object} capitan - Datos del capitán
 * @param {Array} jugadores - Datos de los jugadores
 * @param {Object} evento - Datos del evento
 * @param {Object} juego - Datos del juego seleccionado
 * @param {String} nombreEquipo - Nombre del equipo
 * @returns {Promise} - Promesa con respuesta del envío al capitán
 */
export const enviarConfirmacionEquipo = async (capitan, jugadores, evento, juego, nombreEquipo) => {
    // 1. Generar URL única para el QR del capitán
    const qrUrlCapitan = generateQRString(capitan);

    // 2. Guardar la URL del capitán en la base de datos
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

    // 3. Generar el código QR como data URL para el email del capitán
    let qrDataUrlCapitan = '';
    try {
        qrDataUrlCapitan = await generateQRAsDataURL(qrUrlCapitan);
    } catch (qrError) {
        console.error("Error al generar QR como data URL:", qrError);
    }

    // 4. Extraer el nombre del juego como string
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

    // 5. Generar HTML de FAQs específicas para este juego
    const faqsHtml = getFAQsHtmlForEmail([juegoTexto]);

    // 6. Asegurarse de que los miembros del equipo sean un array
    const jugadoresArray = Array.isArray(jugadores) ? jugadores : [];

    // 7. Información adicional para incluir en el correo
    const infoEquipo = `Equipo: ${nombreEquipo || 'Sin nombre'}`;

    // 8. Crear HTML para el QR del capitán
    const qrHtmlCapitan = qrDataUrlCapitan ? `
    <div style="margin: 30px 0; text-align: center;">
        <h3 style="margin-bottom: 10px;">Tu código QR de asistencia (capitán):</h3>
        <p style="margin-bottom: 15px;">Mostra este <strong> código QR </strong> al llegar al evento para registrar tu asistencia.</p>
        <img src="${qrDataUrlCapitan}" alt="Código QR" style="max-width: 200px; height: auto; margin-bottom: 10px;" />
    </div>` : '';

    // 9. Crear parámetros para el template del email del capitán
    const templateParamsCapitan = {
        to_email: capitan.email || '',
        to_name: `${capitan.nombre || ''} ${capitan.apellido || ''}`,
        evento_fecha: evento?.fecha_inicio || '',
        evento_lugar: evento?.localidad || '',
        evento_hora: evento.hora_inicio || '',
        juegos_lista_texto: `${juegoTexto} (${infoEquipo})`,
        faqs_html: faqsHtml, // Añadir las FAQs como HTML
        qr_code_html: qrHtmlCapitan // Añadir el QR como HTML
    };

    // 10. Enviar correo al capitán
    const resultadoCapitan = await emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        templateParamsCapitan,
        EMAIL_PUBLIC_KEY
    );

    // 11. Enviar correos a todos los demás miembros del equipo que tengan email
    const promesasJugadores = jugadoresArray
        .filter(jugador => jugador.email) // Solo a los que tienen email
        .map(async jugador => {
            // Generar QR único para cada jugador
            const qrUrlJugador = generateQRString(jugador);

            // Guardar QR del jugador en la base de datos
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

            // Generar data URL para el QR del jugador
            let qrDataUrlJugador = '';
            try {
                qrDataUrlJugador = await generateQRAsDataURL(qrUrlJugador);
            } catch (error) {
                console.error(`Error al generar QR para jugador ${jugador.nombre}:`, error);
            }

            // Crear HTML para el QR del jugador
            const qrHtmlJugador = qrDataUrlJugador ? `
            <div style="margin: 30px 0; text-align: center;">
                <h3 style="margin-bottom: 10px;">Tu código QR de asistencia:</h3>
                <p style="margin-bottom: 15px;">Mostra este <strong> código QR </strong> al llegar al evento para registrar tu asistencia.</p>
                <img src="${qrDataUrlJugador}" alt="Código QR" style="max-width: 200px; height: auto; margin-bottom: 10px;" />
            </div>` : '';

            const templateParamsJugador = {
                to_email: jugador.email || '',
                to_name: `${jugador.nombre || ''} ${jugador.apellido || ''}`,
                evento_fecha: evento?.fecha_inicio || '',
                evento_lugar: evento?.localidad || '',
                evento_hora: evento.hora_inicio || '',
                juegos_lista_texto: `${juegoTexto} (${infoEquipo} - Capitán: ${capitan.nombre || ''} ${capitan.apellido || ''})`,
                faqs_html: faqsHtml, // Añadir las FAQs como HTML
                qr_code_html: qrHtmlJugador // Añadir el QR como HTML
            };

            return emailjs.send(
                EMAIL_SERVICE_ID,
                EMAIL_TEMPLATE_ID,
                templateParamsJugador,
                EMAIL_PUBLIC_KEY
            );
        });

    // 12. Enviar todos los correos en paralelo, pero no esperar a que terminen
    Promise.all(promesasJugadores).catch(error => {
        console.error('Error enviando emails a jugadores:', error);
    });

    // 13. Devolver el resultado del envío al capitán
    return resultadoCapitan;
};
import emailjs from '@emailjs/browser'
import { getFAQsHtmlForEmail } from './faqEmail'
import { generateQRString, generateQRAsDataURL } from './qrCodeGenerator'
import supabase from './supabase'

// Configurar con tus credenciales de EmailJS
const EMAIL_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const EMAIL_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const EMAIL_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

// Email de prueba — usa Resend (API propia); cualquier otro usa EmailJS
const RESEND_TEST_EMAIL = 'juanferreyra2684@gmail.com';

const enviarConResend = async (templateParams) => {
    const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateParams),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al enviar con Resend');
    return data;
};

const DIAS_EMAIL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const formatearDiasEmail = (dias) => {
    if (!dias || dias.length === 0) return '';
    return dias.map(d => {
        const [y, m, day] = d.split('-').map(Number);
        return DIAS_EMAIL[new Date(y, m - 1, day).getDay()];
    }).join(' y ');
};

// Formatea una fecha ISO "YYYY-MM-DD" como "Domingo 06/07"
const formatearFechaParaMail = (fechaStr) => {
    const [y, m, d] = fechaStr.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return `${DIAS_EMAIL[fecha.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

// Devuelve la(s) fecha(s) relevantes para el jugador según los días específicos de sus juegos.
// Si los juegos no tienen días asignados, cae al inicio del evento.
const calcularFechasMail = (diasJuegos, fechaInicioEvento) => {
    const diasUnicos = [...new Set(diasJuegos.filter(Boolean))].sort();
    const fechas = diasUnicos.length > 0 ? diasUnicos : [fechaInicioEvento];
    return fechas.map(formatearFechaParaMail).join(' y ');
};


const normalizarJuegos = (juegos) => {
    if (!Array.isArray(juegos)) return [];
    return juegos.map(j =>
        typeof j === 'string' ? { game_name: j, dias: [] } : { game_name: j.game_name, dias: j.dias ?? [] }
    );
};

/**
 * Envía un correo de confirmación de inscripción individual sin código QR
 * @param {Object} inscripcion - Datos de la inscripción
 * @param {Object} evento - Datos del evento
 * @param {Array} juegosSeleccionados - Objetos de juego (con game_name y dias) o strings
 * @returns {Promise} - Promesa con respuesta del envío
 */
export const enviarConfirmacionIndividual = async (inscripcion, evento, juegosSeleccionados) => {
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

    // 3. Normalizar juegos a objetos {game_name, dias}
    const juegos = normalizarJuegos(juegosSeleccionados);
    const nombresJuegos = juegos.map(j => j.game_name);

    // Fecha(s) relevantes: los días específicos de los juegos del jugador,
    // o la fecha de inicio del evento si no hay días asignados
    const diasJuegos = juegos.flatMap(j => j.dias?.length ? j.dias : []);
    const fechasParaMail = calcularFechasMail(diasJuegos, evento.fecha_inicio);

    // 4. Construir texto de juegos: en eventos multi-día, siempre muestra los días
    //    específicos del juego para evitar confusión (aunque sea solo el día de inicio).
    //    En eventos de un día, omite el día si coincide con el inicio (es obvio).
    const esEventoMultiDia = Boolean(evento.fecha_fin && evento.fecha_fin !== evento.fecha_inicio);
    const juegosTexto = juegos.map(j => {
        if (!j.dias || j.dias.length === 0) return j.game_name;
        if (!esEventoMultiDia && j.dias.length === 1 && j.dias[0] === evento.fecha_inicio) return j.game_name;
        const diasTexto = formatearDiasEmail(j.dias);
        if (!diasTexto) return j.game_name;
        const prefijo = j.dias.length === 1 ? 'sólo ' : '';
        return `${j.game_name} (${prefijo}${diasTexto})`;
    }).join(', ');

    // 4. Generar HTML de FAQs específicas para estos juegos
    const faqsHtml = getFAQsHtmlForEmail(nombresJuegos);

    // 5. Configurar parámetros para la plantilla de email (sin QR)
    const ubicacionHtml = evento.ubicacion_url
        ? `<a href="${evento.ubicacion_url}" target="_blank" rel="noopener noreferrer" style="color:#3b6cb4;font-weight:600;">📍 Ver ubicación en Google Maps</a>`
        : '';

    const templateParams = {
        to_email: inscripcion.email || '',
        to_name: `${inscripcion.nombre || ''} ${inscripcion.apellido || ''}`,
        evento_fecha: fechasParaMail,
        evento_lugar: evento.localidad || '',
        evento_direccion: evento.direccion || '',
        evento_hora: evento.hora_inicio || '',
        evento_ubicacion_html: ubicacionHtml,
        juegos_lista_texto: juegosTexto,
        faqs_html: faqsHtml,
        qr_code_html: ''
    };

    // 6. Enviar — Resend si es el mail de prueba, EmailJS para el resto
    if (inscripcion.email === RESEND_TEST_EMAIL) {
        return enviarConResend(templateParams);
    }

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

    // Fecha(s) relevantes según días específicos del juego de equipo
    const diasJuegoEquipo = typeof juego === 'object' ? (juego?.dias ?? []) : [];
    const fechasParaMailEquipo = calcularFechasMail(diasJuegoEquipo, evento?.fecha_inicio);

    // . Asegurarse de que los miembros del equipo sean un array
    const jugadoresArray = Array.isArray(jugadores) ? jugadores : [];

    // 6. Información adicional para incluir en el correo
    const infoEquipo = `Equipo: ${nombreEquipo || 'Sin nombre'}`;

    // 7. Crear parámetros para el template del email del capitán (sin QR)
    const ubicacionHtmlEquipo = evento?.ubicacion_url
        ? `<a href="${evento.ubicacion_url}" target="_blank" rel="noopener noreferrer" style="color:#3b6cb4;font-weight:600;">📍 Ver ubicación en Google Maps</a>`
        : '';

    const templateParamsCapitan = {
        to_email: capitan.email || '',
        to_name: `${capitan.nombre || ''} ${capitan.apellido || ''}`,
        evento_fecha: fechasParaMailEquipo,
        evento_lugar: evento?.localidad || '',
        evento_direccion: evento?.direccion || '',
        evento_hora: evento?.hora_inicio || '',
        evento_ubicacion_html: ubicacionHtmlEquipo,
        juegos_lista_texto: `${juegoTexto} (${infoEquipo})`,
        faqs_html: faqsHtml,
        qr_code_html: ''
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
                evento_fecha: fechasParaMailEquipo,
                evento_lugar: evento?.localidad || '',
                evento_direccion: evento?.direccion || '',
                evento_hora: evento?.hora_inicio || '',
                evento_ubicacion_html: ubicacionHtmlEquipo,
                juegos_lista_texto: `${juegoTexto} (${infoEquipo} - Capitán: ${capitan.nombre || ''} ${capitan.apellido || ''})`,
                faqs_html: faqsHtml,
                qr_code_html: ''
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
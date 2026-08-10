import { generateQRString } from './qrCodeGenerator'
import supabase from './supabase'

const enviarConResend = async (templateParams) => {
    const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateParams),
    });

    // No asumir que el cuerpo existe ni que es JSON válido: un crash de la
    // función serverless (timeout, error no manejado antes de llegar al
    // handler, etc.) puede devolver un cuerpo vacío o HTML de error de la
    // plataforma. Leer como texto primero evita que `res.json()` tape ese
    // problema real detrás de "Unexpected end of JSON input".
    const rawText = await res.text();
    let data = null;
    if (rawText) {
        try {
            data = JSON.parse(rawText);
        } catch {
            throw new Error(
                `Error al enviar con Resend (HTTP ${res.status} ${res.statusText}): la respuesta no fue JSON válido.`
            );
        }
    }

    if (!res.ok) {
        throw new Error(
            data?.error || `Error al enviar con Resend (HTTP ${res.status} ${res.statusText}).`
        );
    }

    if (!data) {
        throw new Error(`Error al enviar con Resend (HTTP ${res.status}): respuesta vacía.`);
    }

    return data;
};

const DIAS_EMAIL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Formatea una fecha ISO "YYYY-MM-DD" como "Domingo 06/07"
const formatearFechaParaMail = (fechaStr) => {
    const [y, m, d] = fechaStr.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return `${DIAS_EMAIL[fecha.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

// Fecha del evento para el mail: inicio, y también fin si el evento dura más
// de un día (mismo criterio que EventoModal.jsx: solo se muestra el fin si
// es distinto del inicio). Es la fecha del evento, no la del participante.
const formatearFechaEventoParaMail = (evento) => {
    const inicio = formatearFechaParaMail(evento.fecha_inicio);
    const fin = evento.fecha_fin && evento.fecha_fin !== evento.fecha_inicio
        ? formatearFechaParaMail(evento.fecha_fin)
        : null;
    return fin ? `${inicio} – ${fin}` : inicio;
};

// No depende de una lista fija de juegos conocidos: cualquier juego nuevo
// pasa igual, siempre que tenga (o se le pueda asignar) un `game_name` en
// forma de string — evita que un juego con forma inesperada (objeto sin
// `game_name`, `null`, etc.) propague `undefined` al email.
const nombresDeJuegos = (juegos) => {
    if (!Array.isArray(juegos)) return [];
    return juegos
        .filter(j => j !== null && j !== undefined)
        .map(j => {
            if (typeof j === 'string') return j;
            if (typeof j.game_name === 'string' && j.game_name.trim()) return j.game_name;
            const propiedadTexto = Object.values(j).find(val => val && typeof val === 'string');
            return propiedadTexto || 'Juego';
        });
};

/**
 * Envía un correo de confirmación de inscripción individual sin código QR.
 * El correo informa solo los datos básicos del evento (fecha, hora, lugar,
 * ubicación y los videojuegos disponibles en el evento) — no datos del
 * participante ni de los juegos que haya elegido.
 * @param {Object} inscripcion - Datos de la inscripción
 * @param {Object} evento - Datos del evento
 * @param {Array} todosLosJuegosEvento - Todos los juegos configurados para el evento
 * @returns {Promise} - Promesa con respuesta del envío
 */
export const enviarConfirmacionIndividual = async (inscripcion, evento, todosLosJuegosEvento) => {
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

    // 3. Todos los juegos configurados para el evento (no solo los que eligió el participante)
    const juegosTexto = nombresDeJuegos(todosLosJuegosEvento).join(', ');

    // 4. Configurar parámetros para la plantilla de email (sin QR)
    const ubicacionHtml = evento.ubicacion_url
        ? `<a href="${evento.ubicacion_url}" target="_blank" rel="noopener noreferrer" style="color:#3b6cb4;font-weight:600;">📍 Ver ubicación en Google Maps</a>`
        : '';

    const templateParams = {
        to_email: inscripcion.email || '',
        to_name: `${inscripcion.nombre || ''} ${inscripcion.apellido || ''}`,
        evento_fecha: formatearFechaEventoParaMail(evento),
        evento_lugar: evento.localidad || '',
        evento_direccion: evento.direccion || '',
        evento_hora: evento.hora_inicio || '',
        evento_ubicacion_html: ubicacionHtml,
        juegos_lista_texto: juegosTexto,
    };

    // 5. Enviar con Resend
    return enviarConResend(templateParams);
};

/**
 * Envía correos de confirmación para inscripción de equipo sin códigos QR.
 * El correo informa solo los datos básicos del evento (fecha, hora, lugar,
 * ubicación y los videojuegos disponibles en el evento) — no datos del
 * participante, del equipo ni del juego que hayan elegido.
 * @param {Object} capitan - Datos del capitán
 * @param {Array} jugadores - Datos de los jugadores
 * @param {Object} evento - Datos del evento
 * @param {Array} todosLosJuegosEvento - Todos los juegos configurados para el evento
 * @returns {Promise} - Promesa con respuesta del envío al capitán
 */
export const enviarConfirmacionEquipo = async (capitan, jugadores, evento, todosLosJuegosEvento) => {
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

    // 3. Todos los juegos configurados para el evento (no solo el que eligió el equipo)
    const juegosTexto = nombresDeJuegos(todosLosJuegosEvento).join(', ');

    // 4. Asegurarse de que los miembros del equipo sean un array
    const jugadoresArray = Array.isArray(jugadores) ? jugadores : [];

    // 5. Crear parámetros para el template del email del capitán (sin QR)
    const ubicacionHtmlEquipo = evento?.ubicacion_url
        ? `<a href="${evento.ubicacion_url}" target="_blank" rel="noopener noreferrer" style="color:#3b6cb4;font-weight:600;">📍 Ver ubicación en Google Maps</a>`
        : '';

    const templateParamsCapitan = {
        to_email: capitan.email || '',
        to_name: `${capitan.nombre || ''} ${capitan.apellido || ''}`,
        evento_fecha: formatearFechaEventoParaMail(evento),
        evento_lugar: evento?.localidad || '',
        evento_direccion: evento?.direccion || '',
        evento_hora: evento?.hora_inicio || '',
        evento_ubicacion_html: ubicacionHtmlEquipo,
        juegos_lista_texto: juegosTexto,
    };

    // 6. Enviar correo al capitán
    const resultadoCapitan = await enviarConResend(templateParamsCapitan);

    // 7. Enviar correos a todos los demás miembros del equipo que tengan email
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
                evento_fecha: formatearFechaEventoParaMail(evento),
                evento_lugar: evento?.localidad || '',
                evento_direccion: evento?.direccion || '',
                evento_hora: evento?.hora_inicio || '',
                evento_ubicacion_html: ubicacionHtmlEquipo,
                juegos_lista_texto: juegosTexto,
            };

            return enviarConResend(templateParamsJugador);
        });

    // 8. Enviar todos los correos en paralelo, pero no esperar a que terminen
    Promise.all(promesasJugadores).catch(error => {
        console.error('Error enviando emails a jugadores:', error);
    });

    // 9. Devolver el resultado del envío al capitán
    return resultadoCapitan;
};

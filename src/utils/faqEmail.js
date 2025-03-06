// src/utils/faqEmail.js
import { faqData } from './faqData';

/**
 * Obtiene las FAQs para una lista de juegos en formato HTML para correo electrónico
 * @param {Array|String} juegos - Lista de juegos o string con nombres de juegos separados por coma
 * @returns {String} HTML formateado con las FAQs
 */
export const getFAQsHtmlForEmail = (juegos) => {
    // Normalizar juegos a un array de strings
    let juegosArray = [];

    if (Array.isArray(juegos)) {
        juegosArray = juegos;
    } else if (typeof juegos === 'string') {
        juegosArray = juegos.split(',').map(j => j.trim());
    } else if (juegos && typeof juegos === 'object') {
        // Extraer valores si es un objeto
        juegosArray = Object.values(juegos)
            .filter(val => val && typeof val === 'string')
            .map(j => j.trim());
    }

    // Mapa para convertir nombres de juegos a las claves de faqData
    const juegoACategoria = {
        'Free Fire': 'freeFire',
        'Valorant': 'valorant',
        'Counter Strike': 'counterStrike',
        'Counter Strike 2': 'counterStrike',
        'CS2': 'counterStrike',
        'Fórmula 1': 'formula1',
        'F1': 'formula1',
        'Formula 1': 'formula1',
        'League of Legends': 'lol',
        'LOL': 'lol',
        'FIFA': 'fifa',
        'EA FC': 'fifa'
    };

    // Identificar qué categorías de FAQs necesitamos
    const categoriasNecesarias = new Set();

    // Siempre incluir las FAQs generales
    categoriasNecesarias.add('general');

    // Añadir las categorías correspondientes a los juegos
    juegosArray.forEach(juego => {
        // Normalizar el nombre del juego eliminando espacios extras
        const juegoNormalizado = juego.trim();

        // Buscar una coincidencia en nuestro mapa
        for (const [nombreJuego, categoria] of Object.entries(juegoACategoria)) {
            // Verificar si el nombre normalizado del juego contiene el nombre de la clave
            if (juegoNormalizado.toLowerCase().includes(nombreJuego.toLowerCase())) {
                categoriasNecesarias.add(categoria);
                break;
            }
        }
    });

    // Construir el HTML con las FAQs
    let htmlFaqs = `
    <h2 style="color: #2575fc; font-size: 18px; margin-top: 25px; margin-bottom: 10px;">Preguntas Frecuentes</h2>
  `;

    // Generar el HTML para cada categoría
    for (const categoria of categoriasNecesarias) {
        if (faqData[categoria]) {
            const categoriaData = faqData[categoria];

            // Verificar que no sea la categoría general si hay más categorías
            if (categoria !== 'general' || categoriasNecesarias.size === 1) {
                htmlFaqs += `
          <h3 style="color: #6a11cb; font-size: 16px; margin-top: 15px; margin-bottom: 8px;">${categoriaData.title}</h3>
        `;
            }

            // Añadir cada pregunta y respuesta
            htmlFaqs += `<div style="margin-bottom: 20px;">`;

            categoriaData.faqs.forEach((faq, index) => {
                htmlFaqs += `
          <div style="margin-bottom: 10px;">
            <p style="font-weight: bold; margin-bottom: 5px;">${faq.question}</p>
            <p style="margin-top: 0; padding-left: 15px; border-left: 3px solid #2575fc;">${faq.answer}</p>
          </div>
        `;
            });

            htmlFaqs += `</div>`;
        }
    }

    return htmlFaqs;
};
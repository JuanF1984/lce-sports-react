import emailjs from '@emailjs/browser'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const BULK_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_BULK_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

/**
 * Convierte el HTML de Quill a HTML compatible con clientes de email.
 * Los clientes de email resetean márgenes de <p> y colapsan párrafos vacíos.
 * Solución: convertir <p> a <div> con spacing inline.
 */
const prepararCuerpoEmail = (html) => {
    return html
        // Párrafos vacíos (Enter sin texto) → div con altura visible
        .replace(/<p><br><\/p>/g, '<div style="height:0.9em;">&nbsp;</div>')
        // Todos los demás párrafos → div con line-height y separación inferior
        .replace(/<p>([\s\S]*?)<\/p>/g,
            '<div style="margin:0;padding-bottom:0.6em;line-height:1.7;">$1</div>')
}

/**
 * Envía un email masivo a un destinatario individual.
 * @param {Object} destinatario - { nombre, apellido, email }
 * @param {string} asunto - Asunto del email
 * @param {string} cuerpo - HTML generado por Quill
 * @param {string} imagenSrc - Base64 data URL o URL pública de imagen (puede ser "")
 */
export const enviarEmailMasivo = (destinatario, asunto, cuerpo, imagenSrc) => {
    // Construimos el HTML de la imagen en JS para evitar condicionales
    // {{#if}} en el template de EmailJS, que no es confiable.
    const imageHtml = imagenSrc
        ? `<img src="${imagenSrc}" alt="Imagen" style="max-width:100%;border-radius:8px;display:block;margin:0 auto;box-shadow:0 4px 15px rgba(0,0,0,0.4);" />`
        : ''

    const templateParams = {
        to_email: destinatario.email,
        to_name: `${destinatario.nombre} ${destinatario.apellido}`.trim(),
        subject: asunto,
        message_body: prepararCuerpoEmail(cuerpo),
        image_html: imageHtml,
    }

    return emailjs.send(SERVICE_ID, BULK_TEMPLATE_ID, templateParams, PUBLIC_KEY)
}

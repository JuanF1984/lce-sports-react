import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const buildEmailHtml = (params) => {
    const {
        to_name = '',
        evento_fecha = '',
        evento_lugar = '',
        evento_direccion = '',
        evento_hora = '',
        evento_ubicacion_html = '',
        juegos_lista_texto = '',
        faqs_html = '',
    } = params;

    const row = (label, value) => value ? `
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;width:90px;vertical-align:top;">${label}</td>
          <td style="padding:5px 0;color:#1a2744;font-size:14px;vertical-align:top;">${value}</td>
        </tr>` : '';

    const ubicacionRow = evento_ubicacion_html ? `
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;width:90px;vertical-align:top;">Ubicación</td>
          <td style="padding:5px 0;font-size:14px;vertical-align:top;">${evento_ubicacion_html}</td>
        </tr>` : '';

    const juegosRow = juegos_lista_texto ? `
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;width:90px;vertical-align:top;">Juegos</td>
          <td style="padding:5px 0;color:#3b6cb4;font-size:14px;font-weight:600;vertical-align:top;">${juegos_lista_texto}</td>
        </tr>` : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Confirmación de Inscripción</title>
</head>
<body style="margin:0;padding:0;background:#f0f4fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4fa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(26,39,68,0.10);">

          <!-- Encabezado -->
          <tr>
            <td style="background:#1a2744;padding:28px 24px;text-align:center;">
              <img
                src="https://lcesports.com.ar/assets/img/logo.webp"
                alt="LC e-SPORTS"
                width="72"
                style="border-radius:50%;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;"
              />
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.02em;">
                Confirmación de Inscripción
              </h1>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:28px 28px 8px;">

              <p style="margin:0 0 6px;color:#1a2744;font-size:16px;">
                Hola <strong>${to_name}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;">
                ¡Tu inscripción fue registrada exitosamente! Te esperamos en el evento.
              </p>

              <!-- Detalles del evento -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px 4px;">
                    <p style="margin:0 0 12px;color:#1a2744;font-size:15px;font-weight:700;">
                      Detalles del Evento
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      ${row('Fecha', evento_fecha)}
                      ${row('Lugar', evento_lugar)}
                      ${row('Dirección', evento_direccion)}
                      ${ubicacionRow}
                      ${row('Hora', evento_hora)}
                      ${juegosRow}
                    </table>
                  </td>
                </tr>
                <tr><td style="height:12px;"></td></tr>
              </table>

              <!-- FAQs -->
              ${faqs_html}

              <!-- Cierre -->
              <p style="margin:24px 0 4px;color:#374151;font-size:14px;">
                ¡Esperamos verte pronto y que disfrutes del evento!
              </p>
              <p style="margin:0 0 28px;color:#374151;font-size:14px;">
                Saludos,<br />
                <strong>El equipo de LC e-SPORTS</strong>
              </p>

            </td>
          </tr>

          <!-- Pie de página -->
          <tr>
            <td style="background:#1a2744;padding:20px 24px;text-align:center;">
              <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;">
                © 2026 LC e-SPORTS — todos los derechos reservados
              </p>
              <p style="margin:0;color:#6b7280;font-size:11px;">
                Este es un correo automático, por favor no respondas a este mensaje.<br />
                lcesports.com.ar
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const params = req.body;
        const html = buildEmailHtml(params);

        const response = await resend.emails.send({
            from: 'LC e-SPORTS <no-reply@lcesports.com.ar>',
            to: [params.to_email],
            subject: 'Confirmación de inscripción — LC e-SPORTS',
            html,
        });

        return res.status(200).json({ ok: true, id: response.data?.id });
    } catch (error) {
        console.error('Resend error:', error);
        return res.status(500).json({
            ok: false,
            error: error?.message || 'Error al enviar el correo',
        });
    }
}

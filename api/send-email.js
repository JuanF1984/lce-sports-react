import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, nombre } = req.body;

    const response = await resend.emails.send({
      from: 'LCE Sports <contacto@lcesports.com.ar>',
      to: [email],
      subject: 'Confirmación de inscripción',
      html: `<p>Hola ${nombre}, tu inscripción fue registrada correctamente.</p>`,
    });

    return res.status(200).json({ ok: true, response });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Error al enviar el correo',
    });
  }
}
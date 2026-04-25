import { resend, FROM } from '../../_lib/resend.js';
import { renderMegaeventoTemplate } from '../../../src/email/templates/megaeventoTemplate.js';

const sanitizeHtml = (html) =>
    html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\s+on\w+="[^"]*"/gi, '')
        .replace(/\s+on\w+='[^']*'/gi, '');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { recipients, subject, messageBody, imageHtml = '' } = req.body || {};

    if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: 'recipients must be a non-empty array' });
    }
    if (recipients.length > 100) {
        return res.status(400).json({ error: 'recipients must have at most 100 items per batch' });
    }

    const safeBody = sanitizeHtml(messageBody || '');

    const emails = recipients.map(r => ({
        from: FROM,
        to: [r.email],
        subject: subject || '(sin asunto)',
        html: renderMegaeventoTemplate({
            toName: r.name || r.email,
            toEmail: r.email,
            messageBody: safeBody,
            imageHtml,
        }),
    }));

    try {
        const { data, error } = await resend.batch.send(emails);

        if (error) {
            return res.status(500).json({
                sent: 0,
                failed: recipients.map(r => ({ email: r.email, error: error.message || 'Resend error' })),
            });
        }

        // Resend SDK v6: data = { data: Array<{id}> }
        const results = data?.data;
        const failed = [];
        let sent = 0;
        if (Array.isArray(results) && results.length > 0) {
            results.forEach((result, idx) => {
                if (result?.id) {
                    sent++;
                } else {
                    failed.push({ email: recipients[idx]?.email, error: 'No ID returned by Resend' });
                }
            });
        } else {
            // No per-item data but no error either — assume all sent
            sent = recipients.length;
        }

        return res.status(200).json({ sent, failed });
    } catch (err) {
        console.error('send-batch error:', err);
        return res.status(500).json({
            sent: 0,
            failed: recipients.map(r => ({ email: r.email, error: err?.message || 'Error desconocido' })),
        });
    }
}

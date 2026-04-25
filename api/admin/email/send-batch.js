import { resend, FROM } from '../../_lib/resend.js';
import { renderMegaeventoTemplate } from '../../../src/email/templates/megaeventoTemplate.js';
import { validateEmail } from '../../../src/lib/email/validateEmail.js';
import { sanitizeName } from '../../../src/lib/email/sanitizeName.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const EMAIL_IN_TEXT_REGEX = /\S+@\S+\.\S+/g;
const TRANSIENT_ERROR_PATTERNS = [/rate.?limit/i, /timeout/i, /5\d\d/];

const sanitizeHtml = (html) =>
    html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\s+on\w+="[^"]*"/gi, '')
        .replace(/\s+on\w+='[^']*'/gi, '');

const isEmailRelatedError = (msg) =>
    msg && (/non-ascii/i.test(msg) || /invalid.*email/i.test(msg) || /email.*invalid/i.test(msg));

const isTransientError = (msg) =>
    msg && TRANSIENT_ERROR_PATTERNS.some(p => p.test(msg));

async function markInvalidEmail(email, reason) {
    try {
        await supabase.from('invalid_emails').upsert(
            [{ email, reason: reason.slice(0, 500), detected_by: 'resend_error' }],
            { onConflict: 'email', ignoreDuplicates: true }
        );
    } catch (err) {
        console.error('[send-batch] Error al marcar email inválido en DB:', err.message);
    }
}

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
    const failed = [];
    const validRecipients = [];

    // Validar emails antes de enviar al batch de Resend
    for (const r of recipients) {
        const result = validateEmail(r.email);
        if (!result.valid) {
            failed.push({ email: r.email, error: result.reason });
            await markInvalidEmail(result.normalized || r.email.toLowerCase().trim(), result.reason);
        } else {
            validRecipients.push({ ...r, email: result.normalized });
        }
    }

    if (validRecipients.length === 0) {
        return res.status(200).json({ sent: 0, failed });
    }

    const emails = validRecipients.map(r => ({
        from: FROM,
        to: [r.email],
        subject: subject || '(sin asunto)',
        html: renderMegaeventoTemplate({
            toName: sanitizeName(r.name || r.email),
            toEmail: r.email,
            messageBody: safeBody,
            imageHtml,
        }),
    }));

    try {
        const { data, error } = await resend.batch.send(emails);

        if (error) {
            console.error('[send-batch] Error de Resend:', {
                message: error.message,
                name: error.name,
                recipientsCount: validRecipients.length,
                firstEmail: validRecipients[0]?.email,
            });

            if (isEmailRelatedError(error.message) && !isTransientError(error.message)) {
                const emailsInMsg = error.message.match(EMAIL_IN_TEXT_REGEX) || [];
                for (const email of emailsInMsg) {
                    await markInvalidEmail(email.toLowerCase(), error.message.slice(0, 500));
                }
            }

            return res.status(200).json({
                sent: 0,
                failed: [
                    ...failed,
                    ...validRecipients.map(r => ({ email: r.email, error: error.message || 'Resend error' })),
                ],
            });
        }

        // Resend SDK v6: data = { data: Array<{id}> }
        const results = data?.data;
        let sent = 0;
        if (Array.isArray(results) && results.length > 0) {
            results.forEach((result, idx) => {
                if (result?.id) {
                    sent++;
                } else {
                    failed.push({ email: validRecipients[idx]?.email, error: 'No ID returned by Resend' });
                }
            });
        } else {
            sent = validRecipients.length;
        }

        return res.status(200).json({ sent, failed });
    } catch (err) {
        console.error('[send-batch] Excepción:', {
            message: err.message,
            stack: err.stack,
            name: err.name,
            recipientsCount: recipients.length,
            firstEmail: recipients[0]?.email,
        });
        return res.status(200).json({
            sent: 0,
            failed: [
                ...failed,
                ...validRecipients.map(r => ({ email: r.email, error: err?.message || 'Error desconocido' })),
            ],
        });
    }
}

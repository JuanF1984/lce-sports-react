import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { requireAdmin } from '../../_lib/requireAdmin.js';

export default async function handler(req, res) {
    try {
        await requireAdmin(req);
    } catch (err) {
        return res.status(err.statusCode || 500).json({ error: err.message });
    }

    if (req.method === 'GET') {
        try {
            const { data, error } = await supabaseAdmin
                .from('invalid_emails')
                .select('email, reason, detected_at, detected_by')
                .order('detected_at', { ascending: false });
            if (error) throw error;
            return res.status(200).json({ invalidEmails: data || [] });
        } catch (err) {
            console.error('[invalid-emails] GET error:', err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    if (req.method === 'POST') {
        const { emails } = req.body || {};
        if (!Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'emails must be a non-empty array' });
        }
        try {
            const { error } = await supabaseAdmin.from('invalid_emails').upsert(
                emails.map(e => ({
                    email: e.email,
                    reason: e.reason,
                    detected_by: e.detected_by || 'validation',
                })),
                { onConflict: 'email', ignoreDuplicates: true }
            );
            if (error) throw error;
            return res.status(200).json({ ok: true });
        } catch (err) {
            console.error('[invalid-emails] POST error:', err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

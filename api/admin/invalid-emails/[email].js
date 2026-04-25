import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { requireAdmin } from '../../_lib/requireAdmin.js';

export default async function handler(req, res) {
    try {
        await requireAdmin(req);
    } catch (err) {
        return res.status(err.statusCode || 500).json({ error: err.message });
    }

    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: 'Email requerido' });
    }

    // GET — inscripciones asociadas al email
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabaseAdmin
                .from('inscriptions')
                .select('id, nombre, apellido, email, principal_game, secondary_game, created_at, id_evento')
                .eq('email', email)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.status(200).json({ inscriptions: data || [] });
        } catch (err) {
            console.error('[invalid-emails/email] GET error:', err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    // DELETE — quitar de la blacklist
    if (req.method === 'DELETE') {
        try {
            const { error } = await supabaseAdmin
                .from('invalid_emails')
                .delete()
                .eq('email', email);
            if (error) throw error;
            return res.status(200).json({ ok: true });
        } catch (err) {
            console.error('[invalid-emails/email] DELETE error:', err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: 'Email requerido' });
    }

    // GET /api/admin/invalid-emails/:email — inscripciones asociadas al email
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
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

    // DELETE /api/admin/invalid-emails/:email — quitar de la blacklist
    if (req.method === 'DELETE') {
        try {
            const { error } = await supabase
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

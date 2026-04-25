import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { tournamentId, filters = {} } = req.body || {};

    try {
        let query = supabase
            .from('inscriptions')
            .select('nombre, apellido, email, principal_game, secondary_game');

        if (tournamentId) {
            query = query.eq('id_evento', tournamentId);
        } else if (filters.locality) {
            const { data: events, error: evErr } = await supabase
                .from('events')
                .select('id')
                .eq('localidad', filters.locality);
            if (evErr) throw evErr;
            const ids = (events || []).map(e => e.id);
            if (ids.length === 0) return res.status(200).json({ recipients: [] });
            query = query.in('id_evento', ids);
        }

        if (filters.game) {
            query = query.or(
                `principal_game.eq."1 - ${filters.game}",secondary_game.eq."2 - ${filters.game}"`
            );
        }

        const { data, error } = await query;
        if (error) throw error;

        const emailMap = new Map();
        (data || []).forEach(i => {
            const key = i.email?.toLowerCase().trim();
            if (!key || emailMap.has(key)) return;
            emailMap.set(key, {
                email: i.email,
                name: `${i.nombre} ${i.apellido}`.trim(),
            });
        });

        return res.status(200).json({ recipients: [...emailMap.values()] });
    } catch (error) {
        console.error('Recipients error:', error);
        return res.status(500).json({ error: error?.message || 'Error al obtener destinatarios' });
    }
}

import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { requireAdmin } from '../../_lib/requireAdmin.js';
import { validateEmail, normalizeEmail } from '../../../src/lib/email/validateEmail.js';

export default async function handler(req, res) {
    try {
        await requireAdmin(req);
    } catch (err) {
        return res.status(err.statusCode || 500).json({ error: err.message });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { tournamentId, filters = {} } = req.body || {};

    try {
        let query = supabaseAdmin
            .from('inscriptions')
            .select('nombre, apellido, email, principal_game, secondary_game');

        if (tournamentId) {
            query = query.eq('id_evento', tournamentId);
        } else if (filters.locality) {
            const { data: events, error: evErr } = await supabaseAdmin
                .from('events')
                .select('id')
                .eq('localidad', filters.locality);
            if (evErr) throw evErr;
            const ids = (events || []).map(e => e.id);
            if (ids.length === 0) {
                return res.status(200).json({ recipients: [], excludedCount: 0, newlyInvalidEmails: [] });
            }
            query = query.in('id_evento', ids);
        }

        if (filters.game) {
            query = query.or(
                `principal_game.eq."1 - ${filters.game}",secondary_game.eq."2 - ${filters.game}"`
            );
        }

        const [inscResult, invalidResult] = await Promise.all([
            query,
            supabaseAdmin.from('invalid_emails').select('email'),
        ]);

        if (inscResult.error) throw inscResult.error;

        const raw = inscResult.data || [];
        console.log(`[recipients] inscripciones brutas: ${raw.length}`);

        const invalidSet = new Set((invalidResult.data || []).map(r => r.email.toLowerCase()));

        // Dedup por email normalizado — queda el primero encontrado
        const emailMap = new Map();
        raw.forEach(i => {
            if (!i.email) return;
            const key = normalizeEmail(i.email);
            if (!key || emailMap.has(key)) return;
            emailMap.set(key, {
                email: key,
                name: `${i.nombre || ''} ${i.apellido || ''}`.trim(),
            });
        });

        console.log(`[recipients] después de dedup: ${emailMap.size}`);

        const newlyInvalidEmails = [];
        const recipients = [];
        let excludedByBlacklist = 0;

        for (const [, entry] of emailMap) {
            if (invalidSet.has(entry.email)) {
                excludedByBlacklist++;
                continue;
            }
            const result = validateEmail(entry.email);
            if (!result.valid) {
                newlyInvalidEmails.push({ email: entry.email, reason: result.reason });
                continue;
            }
            recipients.push(entry);
        }

        if (newlyInvalidEmails.length > 0) {
            await supabaseAdmin.from('invalid_emails').upsert(
                newlyInvalidEmails.map(e => ({
                    email: e.email,
                    reason: e.reason,
                    detected_by: 'validation',
                })),
                { onConflict: 'email', ignoreDuplicates: true }
            );
        }

        const excludedCount = excludedByBlacklist + newlyInvalidEmails.length;
        console.log(`[recipients] resultado final: ${recipients.length} válidos, ${excludedCount} excluidos (${newlyInvalidEmails.length} nuevos inválidos)`);

        return res.status(200).json({ recipients, excludedCount, newlyInvalidEmails });
    } catch (error) {
        console.error('[recipients] error:', error);
        return res.status(500).json({ error: error?.message || 'Error al obtener destinatarios' });
    }
}

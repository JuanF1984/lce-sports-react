import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Valida que el request viene de un usuario admin autenticado.
 * Devuelve { user, profile } si pasa la validación.
 * Si no, lanza un Error con statusCode (401 o 403).
 */
export async function requireAdmin(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
        const err = new Error('No autenticado');
        err.statusCode = 401;
        throw err;
    }

    const { data: { user }, error: userError } =
        await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
        const err = new Error('Token inválido');
        err.statusCode = 401;
        throw err;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || profile.role !== 'admin') {
        const err = new Error('Acceso denegado: requiere admin');
        err.statusCode = 403;
        throw err;
    }

    return { user, profile };
}

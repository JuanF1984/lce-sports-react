import supabase from '../utils/supabase';

/**
 * Wrapper de fetch para API routes admin.
 * Agrega automáticamente el Bearer token de la sesión activa.
 */
export async function apiAdminFetch(path, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
        throw new Error('No hay sesión activa');
    }

    return fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
            'Authorization': `Bearer ${token}`,
        },
    });
}

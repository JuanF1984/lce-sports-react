import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// const supabase = createClient(supabaseUrl, supabaseKey);
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true, // Habilita la persistencia de sesión
        detectSessionInUrl: true, // Detecta la sesión después del redireccionamiento OAuth
    },
});

export default supabase;
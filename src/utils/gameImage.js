import supabase from './supabase';

const GAMES_STORAGE_BUCKET = 'juegos';

// URL pública en runtime a partir de games.image_path — nunca se persiste la
// URL, se deriva siempre así (mismo criterio que ya usan GalleryList.jsx/
// GamesList.jsx en el admin). Devuelve null si el juego todavía no tiene
// imagen cargada desde el panel admin (image_path null/vacío); quien llama
// debe mostrar un placeholder neutro en ese caso, NO volver a
// src/data/gameConfig.js ni a los assets hardcodeados de
// public/assets/img/games/ — ver docs/games.md, "Implementado etapa 2".
export const getGameImageUrl = (imagePath) => {
    if (!imagePath) return null;
    return supabase.storage.from(GAMES_STORAGE_BUCKET).getPublicUrl(imagePath).data.publicUrl;
};

import { useState, useEffect } from 'react'
import supabase from '../utils/supabase'

// Lectura de gallery_items para el panel admin (GalleryList.jsx), ordenada
// por sort_order. Mismo patrón que useEvents.jsx: fetch una sola vez al
// montar, y expone setGalleryItems para que quien la usa actualice el state
// local tras un insert/update/delete en vez de volver a pedir todo a
// Supabase (igual que EventsList.jsx hace con useEvents).
export const useGalleryItems = () => {
    const [galleryItems, setGalleryItems] = useState(null)
    const [galleryError, setGalleryError] = useState(null)
    const [galleryLoading, setGalleryLoading] = useState(true)

    useEffect(() => {
        const fetchGalleryItems = async () => {
            try {
                const { data, error } = await supabase
                    .from('gallery_items')
                    .select('id, image_path, title, subtitle, sort_order, created_at')
                    .order('sort_order', { ascending: true })
                if (error) throw error
                setGalleryItems(data)
            } catch (err) {
                setGalleryError(err.message)
            } finally {
                setGalleryLoading(false)
            }
        }
        fetchGalleryItems()
    }, [])

    return { galleryItems, galleryError, galleryLoading, setGalleryItems }
}

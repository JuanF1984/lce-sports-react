// Importación de useState, useEffect, useCallback desde react
import { useState, useEffect, useCallback } from 'react'


// Importación del componente Próximo Evento
import { ProximoEvento } from './ProximoEvento'
// Importación de Redes Sociales
import { RedesSociales } from './redes-sociales/RedesSociales'
// Importación de hook para controlar carga de imagenes
import { useImageLoading } from '../../../hooks/useImageLoading'
// Importación del hook de galería (gallery_items, administrable desde el panel admin)
import { useGalleryItems } from '../../../hooks/useGalleryItems'
// Importación para carrusel de imagenes y texto
import { CarruselTextAndImage } from '../../common/carrusel/carruselTextAndImages/CarruselTextAndImage'
import supabase from '../../../utils/supabase'

// Importación de estilos
import '@styles/Main.css'

// NOTA: `images`/carrousel-buscate/* (código muerto detectado en el
// relevamiento de docs/galeria.md) se deja tal cual — ya estaba sin uso
// antes de este cambio, no es un import que haya quedado muerto como
// consecuencia de reemplazar `textImageItems`. Queda fuera de alcance acá.

const GALLERY_STORAGE_BUCKET = 'galeria';

// URL pública en runtime a partir del path guardado en gallery_items — nunca
// se persiste la URL en base, se deriva siempre así (mismo helper que ya usa
// GalleryList.jsx en el admin).
const getGalleryPublicUrl = (imagePath) =>
  supabase.storage.from(GALLERY_STORAGE_BUCKET).getPublicUrl(imagePath).data.publicUrl;

// Componente Main
export const Main = ({ onLoadComplete }) => {
  const [heroLoaded, setHeroLoaded] = useState(false)

  // Para el CarouselCommon
  const [images, setImages] = useState([]);
  const { isLoading: carouselLoading, handleImageLoad } = useImageLoading();

  useEffect(() => {
    const loadImages = async () => {
      const imagesContext = import.meta.glob('../../../assets/img/carrousel-buscate/*.{png,jpg,jpeg,svg,webp}', { eager: true });
      const loadedImages = Object.values(imagesContext).map((img) => img.default || img);
      setImages(loadedImages);
    };

    loadImages();
  }, []);

  // Fuente real de datos del carrusel de texto+imagen: gallery_items, ya
  // ordenados por sort_order ASC (useGalleryItems hace el .order en la
  // query). Se convierte cada fila a la forma que ya consumía
  // CarruselTextAndImage (title/description/image) — title -> title,
  // subtitle -> description, image_path -> URL pública del bucket `galeria`.
  const { galleryItems, galleryError, galleryLoading } = useGalleryItems();

  const textImageItems = (galleryItems || []).map(item => ({
    title: item.title,
    description: item.subtitle,
    image: getGalleryPublicUrl(item.image_path),
  }));

  const hayImagenesDeGaleria = textImageItems.length > 0;

  useEffect(() => {
    if (galleryError) {
      console.error('Error al cargar la galería para el carrusel de la Home:', galleryError);
    }
  }, [galleryError]);

  // Si la galería ya terminó de cargar pero no hay nada para mostrar (vacía
  // o falló la consulta), el carrusel no se renderiza y ninguna <img> va a
  // disparar handleImageLoad. Sin esto, carouselLoading quedaría en true
  // para siempre y la Home nunca terminaría de cargar (ver App.jsx,
  // handleMainLoad depende de este gate). Se "completa" manualmente ese
  // caso puntual.
  useEffect(() => {
    if (!galleryLoading && !hayImagenesDeGaleria) {
      handleImageLoad();
    }
  }, [galleryLoading, hayImagenesDeGaleria, handleImageLoad]);

  const handleHeroLoad = useCallback(() => {
    setHeroLoaded(true);
  }, []);

  useEffect(() => {
    if (heroLoaded && !carouselLoading) {
      onLoadComplete?.(); // Notifica al padre cuando se han cargado los componentes
    }
  }, [heroLoaded, carouselLoading, onLoadComplete])

  return (
    <main>
      <ProximoEvento onLoadComplete={handleHeroLoad} />

      {hayImagenesDeGaleria && (
        <CarruselTextAndImage
          imagesAndText={textImageItems}
          title="MEGAEVENTO"
          onImageLoad={handleImageLoad}
        />
      )}

      <RedesSociales />
    </main>
  )
}

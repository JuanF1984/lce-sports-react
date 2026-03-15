// Importación de useState, useEffect, useCallback desde react
import { useState, useEffect, useCallback } from 'react'


// Importación del componente Próximo Evento
import { ProximoEvento } from './ProximoEvento'
// Importación de Redes Sociales
import { RedesSociales } from './redes-sociales/RedesSociales'
// Importación de FAQ
import { FAQ } from './FAQ'
// Importación de hook para controlar carga de imagenes
import { useImageLoading } from '../../../hooks/useImageLoading'
// Importación para carrusel de imagenes y texto
import { CarruselTextAndImage } from '../../common/carrusel/carruselTextAndImages/CarruselTextAndImage'

// Importación de estilos
import '@styles/Main.css'

// Importación de imagenes de los torneos
import brandsenImg from '@img/torneos/brandsen.webp';
import colonImg from '@img/torneos/colon.webp';
import hurlinghamImg from '@img/torneos/hurlingham.webp';
import laPlataImg from '@img/torneos/laPlata.webp';
import sanAndresDeGilesImg from '@img/torneos/sanAndresDeGiles.webp';

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

  const textImageItems = [
    {
      title: 'Brandsen',
      description: 'Fecha del torneo: 12 de octubre de 2024',
      image: brandsenImg,
    },
    {
      title: 'Colón',
      description: 'Fecha del torneo: 28 de septiembre de 2024',
      image: colonImg,
    },
    {
      title: 'Hurlingham',
      description: 'Fecha del torneo: 4 de mayo de 2024',
      image: hurlinghamImg,
    },
    {
      title: 'La Plata',
      description: 'Fecha del torneo: 21 de septiembre de 2024',
      image: laPlataImg,
    },
    {
      title: 'San Andrés de Giles',
      description: 'Fecha del torneo: 27 de julio de 2024',
      image: sanAndresDeGilesImg,
    },
  ];

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

      <FAQ />
      <CarruselTextAndImage
        imagesAndText={textImageItems}
        title="MEGAEVENTO"
        onImageLoad={handleImageLoad}
      />
      <RedesSociales />
    </main>
  )
}

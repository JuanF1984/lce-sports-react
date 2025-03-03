// Importación de useState, useEffect, useCallback desde react
import { useState, useEffect, useCallback } from 'react'


// Importación del componente Hero
import { Hero } from './Hero'
// Importación de Redes Sociales
import { RedesSociales } from './redes-sociales/RedesSociales'
// Importación de Reloj
import { RelojRegresivo } from './reloj-regresivo/RelojRegresivo'
// Importación de FAQ
import { FAQ } from './FAQ'
// Importación de hook para controlar carga de imagenes
import { useImageLoading } from '../../../hooks/useImageLoading'
// Importación para carrusel de imagenes
import { CarruselImages } from '../../common/carrusel/carruselImages/CarruselImages'
// Importación para carrusel de imagenes y texto
import { CarruselTextAndImage } from '../../common/carrusel/carruselTextAndImages/CarruselTextAndImage'

// Imortación de botón para inscribirse
import { InscriptionButton } from '../../common/InscriptionButton'

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
  const [inscriptionButtonLoaded, setInscriptionsButtonLoaded] = useState(false);

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

  const handleInscriptionButtonLoaded = useCallback(() => {
    setInscriptionsButtonLoaded(true);
  }, []);

  useEffect(() => {
    if (heroLoaded && inscriptionButtonLoaded && !carouselLoading) {
      onLoadComplete?.(); // Notifica al padre cuando se han cargado los componentes
    }
  }, [heroLoaded, carouselLoading, onLoadComplete])

  const handleScroll = () => {
    const searchElement = document.getElementById('reloj');
    if (searchElement) {
      searchElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

 
  return (
    <main>
      <Hero onLoadComplete={handleHeroLoad} onNavigateToBuscate={handleScroll} />
     
      <RelojRegresivo />
      <InscriptionButton onLoadComplete={handleInscriptionButtonLoaded} />
      
      <CarruselImages
        images={images}
        title="Buscate"
        onImageLoad={handleImageLoad}
      />

      <FAQ />
      <CarruselTextAndImage
        imagesAndText = {textImageItems}
        title = "Torneos"
        onImageLoad={handleImageLoad}
      />
      <RedesSociales />
    </main>
  )
}

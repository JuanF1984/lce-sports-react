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
import { CarruselImages } from '../../common/carrusel/carruselImages/CarruselImages.jsx'
// Importación para carrusel de imagenes y texto
import { CarruselTextAndImage } from '../../common/carrusel/carruselTextAndImages'

// Imortación de botón para inscribirse
import { InscriptionButton } from '../../common/InscriptionButton'

// Importación de estilos
import '@styles/Main.css'

// Importación de imagenes de los torneos
import brandsenImg from '@img/torneos/brandsen.jpg';
import colonImg from '@img/torneos/colon.jpg';
import hurlinghamImg from '@img/torneos/hurlingham.jpg';
import laPlataImg from '@img/torneos/laPlata.jpg';
import sanAndresDeGilesImg from '@img/torneos/sanAndresDeGiles.jpg';

// Componente Main
export const Main = ({ onLoadComplete }) => {
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [inscriptionButtonLoaded, setInscriptionsButtonLoaded] = useState(false);

  // Para el CarouselCommon
  const [images, setImages] = useState([]);
  const { isLoading: carouselLoading, handleImageLoad } = useImageLoading();

  useEffect(() => {
    const loadImages = async () => {
      const imagesContext = import.meta.glob('../../../assets/img/carrousel-buscate/*.{png,jpg,jpeg,svg}', { eager: true });
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
    const searchElement = document.getElementById('buscate');
    if (searchElement) {
      searchElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

 
  return (
    <main>
      <Hero onLoadComplete={handleHeroLoad} onNavigateToBuscate={handleScroll} />
     
      <CarruselImages
        images={images}
        title="Buscate"
        onImageLoad={handleImageLoad}
      />

      <RelojRegresivo />
      <InscriptionButton onLoadComplete={handleInscriptionButtonLoaded} />
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

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

import { CarruselCommon } from '../../common/carrusel/CarruselCommon'
import { useImageLoading } from '../../../hooks/useImageLoading'




import { InscriptionButton } from '../../common/InscriptionButton'

// Importación de estilos
import '@styles/Main.css'

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

  const handleHeroLoad = useCallback(() => {
    setHeroLoaded(true);
  }, []);

    const handleInscriptionButtonLoaded = useCallback(() => {
    setInscriptionsButtonLoaded(true);
  }, []);

  useEffect(() => {
    if (heroLoaded  && inscriptionButtonLoaded && !carouselLoading) {
      onLoadComplete?.(); // Notifica al padre cuando se han cargado los componentes
    }
  }, [heroLoaded, carouselLoading, onLoadComplete])

  const handleScroll = () => {
    const searchElement = document.getElementById('buscate');
    if (searchElement) {
      searchElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const carouselItems = images.map((src, index) => (
    <img
      key={index}
      src={src}
      alt={`Imagen ${index + 1}`}
      onLoad={handleImageLoad}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  ));

  return (
    <main>
      <Hero onLoadComplete={handleHeroLoad} onNavigateToBuscate={handleScroll} />
      <CarruselCommon
        items={carouselItems}
        title="Buscate"
      />
      <RedesSociales />
      <RelojRegresivo />
      <InscriptionButton onLoadComplete={handleInscriptionButtonLoaded} />
      <FAQ />
    </main>
  )
}

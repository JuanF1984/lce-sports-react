// Importación de useState, useEffect, useCallback desde react
import { useState, useEffect, useCallback } from 'react'


// Importación del componente Hero
import { Hero } from './Hero'
// Importación de CarrouselImagenes
import { Carrusel4 } from './carrousel-imagenes/CarrouselImagenes'
// Importación de Redes Sociales
import { RedesSociales } from './redes-sociales/RedesSociales'
// Importación de Reloj
import { RelojRegresivo } from './reloj-regresivo/RelojRegresivo'
// Importación de FAQ
import { FAQ } from './FAQ'

import TournamentRegistration from './inscripcion/InscripcionForm'

import { BotonFormulario } from './BotonFormulario'



// Importación de estilos
import '@styles/Main.css'

// Componente Main
export const Main = ({ onLoadComplete }) => {
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [carouselLoaded, setCarouselLoaded] = useState(false);

  const handleHeroLoad = useCallback(() => {
    setHeroLoaded(true);
  }, []);

  const handleCarouselLoad = useCallback(() => {
    setCarouselLoaded(true);
  }, []);

  useEffect(() => {
    if (heroLoaded && carouselLoaded) {
      onLoadComplete?.(); // Notifica al padre cuando ambos han cargado
    }
  }, [heroLoaded, carouselLoaded, onLoadComplete])

  const handleScroll = () => {
    const searchElement = document.getElementById('buscate');
    if (searchElement) {
      searchElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <main>
      <Hero onLoadComplete={handleHeroLoad} onNavigateToBuscate={handleScroll}/>
      <Carrusel4 onLoadComplete={handleCarouselLoad} />
      <RedesSociales />
      <RelojRegresivo />
      {/* <TournamentRegistration /> */}
      <FAQ />
    </main>
  )
}

import React, { useState, useEffect } from 'react'

import './styles/App.css'

import { LineaNeon } from './components/common/LineaNeon.jsx'
import { LogoNeon } from './components/common/LogoNeon.jsx'

// import { Header } from './components/layout/header/Header.jsx'
import { Header} from './components/layout/header/HeaderCopy.jsx'
import { Main } from './components/layout/main/Main.jsx'

export const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [headerLoaded, setHeaderLoaded] = useState(false);
  const [mainLoaded, setMainLoaded] = useState(false);

  // Agregamos logs para debug
  useEffect(() => {
    if (headerLoaded && mainLoaded) {
      setIsLoading(false);
    }
  }, [headerLoaded, mainLoaded]);

  // Funciones de callback con logs
  const handleHeaderLoad = () => {
    setHeaderLoaded(true);
  };

  const handleMainLoad = () => {
    setMainLoaded(true);
  };

  return (
    <>
      {isLoading && <LogoNeon />}
      <Header onLoadComplete={handleHeaderLoad} />
      <LineaNeon />
      <Main onLoadComplete={handleMainLoad} />
    </>
  );
};

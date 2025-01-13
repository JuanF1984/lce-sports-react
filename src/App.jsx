import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom"

import './styles/App.css'

import { LineaNeon } from './components/common/LineaNeon.jsx'
import { LogoNeon } from './components/common/LogoNeon.jsx'

// import { Header } from './components/layout/header/Header.jsx'
import { Header } from './components/layout/header/HeaderCopy.jsx'
import { Main } from './components/layout/main/Main.jsx'

import { Formulario } from './components/pages/Formulario.jsx'
import InscriptionsList from './components/pages/InscriptionsList.jsx'
import ScrollToTop from './components/common/ScrollToTop.jsx'

import { AuthProvider } from './context/AuthProvider.jsx'

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [headerLoaded, setHeaderLoaded] = useState(false);
  const [mainLoaded, setMainLoaded] = useState(false);
  const localation = useLocation();



  // Agregamos logs para debug
  useEffect(() => {
    if (headerLoaded && (mainLoaded || localation.pathname === "/formulario")) {
      setIsLoading(false);
    }
  }, [headerLoaded, mainLoaded, localation.pathname]);

  // Funciones de callback con logs
  const handleHeaderLoad = () => {
    setHeaderLoaded(true);
  };

  const handleMainLoad = () => {
    setMainLoaded(true);
  };

  return (
    <>
      {/* <Router basename="/lce-sports-react"> */}
      {/* <ScrollToTop /> */}
      {isLoading && <LogoNeon />}
      <Header onLoadComplete={handleHeaderLoad} />
      <LineaNeon />
      <Routes>
        <Route path="/" element={<Main onLoadComplete={handleMainLoad} />} />
        <Route path="/formulario" element={<Formulario />} />
        <Route path="/inscriptions" element={<InscriptionsList />} />
      </Routes>
      {/* </Router> */}
    </>
  );
};

export const AppWrapper = () => {
  return (
    <AuthProvider>
      <Router basename='/lce-sports-react'>
        <ScrollToTop />
        <App />
      </Router>
    </AuthProvider>
  )
}

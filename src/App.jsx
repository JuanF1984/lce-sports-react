import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom"

import './styles/App.css'

import { LineaNeon } from './components/common/LineaNeon.jsx'
import { LogoNeon } from './components/common/LogoNeon.jsx'

// import { Header } from './components/layout/header/Header.jsx'
import { Header } from './components/layout/header/Header.jsx'
import { Main } from './components/layout/main/Main.jsx'
import { Footer } from './components/layout/footer/Footer.jsx'


import {SeleccionInscripcion} from './components/pages/inscripciones/SeleccionInscripcion.jsx'

// Importación del botón de WhatssApp
import WhatsAppButton from './components/common/WhatsAppButton.jsx'

import { DashboardAdmin } from './components/pages/dashboardAdmin/DashboardAdmin.jsx'

import ScrollToTop from './components/common/ScrollToTop.jsx'

import { AuthProvider } from './context/AuthProvider.jsx'

import { useAuth } from './context/UseAuth.jsx'

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [headerLoaded, setHeaderLoaded] = useState(false);
  const [mainLoaded, setMainLoaded] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const localation = useLocation();



  // Agregamos logs para debug
  useEffect(() => {
    if (!authLoading && headerLoaded && (mainLoaded || localation.pathname === "/formulario" || localation.pathname ==="/inscriptions")) {
      setIsLoading(false);
    }
  }, [authLoading, headerLoaded, mainLoaded, localation.pathname]);

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
      <Routes>
        <Route path="/" element={<Main onLoadComplete={handleMainLoad} />} />
        <Route path="/formulario" element={<SeleccionInscripcion />} />
        <Route path="/inscriptions" element={<DashboardAdmin />} />
        {/* Redirige cualquier otra URL a la raíz */}
        <Route path="*" element={<Main />} />
      </Routes>
      <WhatsAppButton />
      <Footer />
    </>
  );
};

export const AppWrapper = () => {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <App />
      </Router>
    </AuthProvider>
  )
}

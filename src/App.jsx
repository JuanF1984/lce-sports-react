import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom"

import './styles/App.css'

import { LineaNeon } from './components/common/LineaNeon.jsx'
import { LogoNeon } from './components/common/LogoNeon.jsx'

// import { Header } from './components/layout/header/Header.jsx'
import { Header } from './components/layout/header/Header.jsx'
import { Main } from './components/layout/main/Main.jsx'
import { Footer } from './components/layout/footer/Footer.jsx'


import { SeleccionInscripcion } from './components/pages/inscripciones/SeleccionInscripcion.jsx'

// Importación del botón de WhatssApp
import WhatsAppButton from './components/common/WhatsAppButton.jsx'

import { DashboardAdmin } from './components/pages/dashboardAdmin/DashboardAdmin.jsx'

import ScrollToTop from './components/common/ScrollToTop.jsx'

import { AuthProvider } from './context/AuthProvider.jsx'

import { useAuth } from './context/UseAuth.jsx'

import { Helmet } from 'react-helmet'

// Componente de verificación para Instagram/Facebook
const SocialAppRedirectWrapper = ({ children }) => {
  const [isInSocialApp, setIsInSocialApp] = useState(false);
  const [isCheckingBrowser, setIsCheckingBrowser] = useState(true);

  useEffect(() => {
    // Detectar navegador de Instagram o Facebook
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const inSocialApp =
      userAgent.indexOf('Instagram') > -1 ||
      userAgent.indexOf('FBAN') > -1 ||
      userAgent.indexOf('FBAV') > -1;

    setIsInSocialApp(inSocialApp);
    setIsCheckingBrowser(false);
  }, []);

  const openInExternalBrowser = () => {
    const currentUrl = window.location.href;
    window.location.href = currentUrl;

    // Método de respaldo
    setTimeout(() => {
      window.open(currentUrl, '_system');
    }, 100);
  };

  // Mostrar pantalla de carga mientras verificamos
  if (isCheckingBrowser) {
    return <div>Cargando...</div>;
  }

  // Si estamos en una app social, mostrar pantalla de redirección
  if (isInSocialApp) {
    return (
      <div style={{
        padding: '20px',
        maxWidth: '500px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <h2>Acceso bloqueado</h2>
        <p>
          Esta aplicación no puede abrirse correctamente desde Instagram
          debido a restricciones de seguridad de Google.
        </p>
        <button
          onClick={openInExternalBrowser}
          style={{
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer',
            margin: '20px 0'
          }}
        >
          Abrir en navegador
        </button>
        <p style={{ fontSize: '14px', color: '#666' }}>
          O copia esta URL y ábrela en tu navegador:
        </p>
        <div style={{
          padding: '10px',
          backgroundColor: '#f1f3f4',
          borderRadius: '4px',
          fontSize: '14px',
          wordBreak: 'break-all'
        }}>
          {window.location.href}
        </div>
      </div>
    );
  }

  // Si estamos en un navegador normal, mostrar la aplicación
  return children;
};


const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [headerLoaded, setHeaderLoaded] = useState(false);
  const [mainLoaded, setMainLoaded] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const localation = useLocation();



  // Agregamos logs para debug
  useEffect(() => {
    if (!authLoading && headerLoaded && (mainLoaded || localation.pathname === "/formulario" || localation.pathname === "/inscriptions")) {
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
        <SocialAppRedirectWrapper>
          <App />
        </SocialAppRedirectWrapper>
      </Router>
    </AuthProvider>
  )
}

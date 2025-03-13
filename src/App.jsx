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

// Componente de verificación para Instagram/Facebook
const SocialAppRedirectWrapper = ({ children }) => {
  const [isInSocialApp, setIsInSocialApp] = useState(false);
  const [isCheckingBrowser, setIsCheckingBrowser] = useState(true);
  const [redirectAttempts, setRedirectAttempts] = useState(0);

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
    // Incrementar el contador de intentos
    setRedirectAttempts(prev => prev + 1);
    
    const currentUrl = window.location.href;

    // Intentar múltiples métodos para abrir en navegador externo

    // Método 1: Navegación directa
    window.location.href = currentUrl;

    // Método 2: Usar window.open con target _blank
    setTimeout(() => {
      const newWindow = window.open(currentUrl, '_blank');
      if (newWindow) {
        newWindow.focus();
      }
    }, 100);

    // Método 3: Para iOS, intentar con el esquema de URL de Safari
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      setTimeout(() => {
        window.location.href = `googlechrome://navigate?url=${encodeURIComponent(currentUrl)}`;
      }, 200);

      setTimeout(() => {
        window.location.href = `x-web-search://?${encodeURIComponent(currentUrl)}`;
      }, 300);
    }

    // Método 4: Para Android, intentar con intent
    if (/android/i.test(navigator.userAgent)) {
      setTimeout(() => {
        window.location.href = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end`;
      }, 200);
    }
  };

  // Si estamos en una app social, mostrar pantalla de redirección
  if (isInSocialApp) {
    return (
      <div style={{
        padding: '20px',
        maxWidth: '500px',
        margin: '0 auto',
        textAlign: 'center',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h2 style={{ color: '#001080' }}>Para mejorar tu experiencia usa el navegador de tu dispositivo</h2>

        <p style={{ color: '#FFFFFF' }}>
          Esta aplicación requiere un navegador completo para funcionar correctamente.
        </p>

        <div style={{
          margin: '20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <button
            onClick={openInExternalBrowser}
            style={{
              backgroundColor: '#001080',
              color: 'white',
              border: 'none',
              padding: '15px 24px',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {redirectAttempts > 0 
              ? `Intentar de nuevo (${redirectAttempts})` 
              : 'Abrir en navegador externo'}
          </button>

          <p style={{ marginTop: '20px', fontSize: '14px', color: '#FFFFFF' }}>Si el botón no funciona:</p>

          <ol style={{ textAlign: 'left', fontSize: '14px', color: '#FFFFFF' }}>
            <li>Copia esta URL:</li>
            <input
              value={window.location.href}
              readOnly
              onClick={(e) => e.target.select()}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '5px',
                marginBottom: '10px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <li>Abre tu navegador (Chrome, Safari, etc.)</li>
            <li>Pega la URL y navega a ella</li>
          </ol>
        </div>

        <div style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          <p><strong>¿Por qué ocurre esto?</strong></p>
          <p>Google bloquea los inicios de sesión desde navegadores integrados como el de Instagram por razones de seguridad.</p>
        </div>
      </div>
    );
  }

  // Mostrar pantalla de carga mientras verificamos
  if (isCheckingBrowser) {
    return <div>Cargando...</div>;
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

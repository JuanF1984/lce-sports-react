import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom"

import './styles/App.css'

import { LogoNeon } from './components/common/LogoNeon.jsx'

import { Header } from './components/layout/header/Header.jsx'
import { Main } from './components/layout/main/Main.jsx'
import { Footer } from './components/layout/footer/Footer.jsx'

import { SeleccionInscripcion } from './components/pages/inscripciones/SeleccionInscripcion.jsx'

import { DashboardAdmin } from './components/pages/dashboardAdmin/DashboardAdmin.jsx'

import ScrollToTop from './components/common/ScrollToTop.jsx'

import { AuthProvider } from './context/AuthProvider.jsx'
import { useAuth } from './context/UseAuth.jsx'
import { BackHandlerProvider } from './context/BackHandlerContext.jsx'

// Importar el componente de verificación de asistencia
import VerifyAttendance from './components/pages/VerifyAttendance.jsx'

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [headerLoaded, setHeaderLoaded] = useState(false);
  const [mainLoaded, setMainLoaded] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const location = useLocation();

  // Verificar si estamos en la ruta de verificación para mostrar un layout diferente
  const isVerifyAttendancePath = location.pathname.includes('/verify-attendance');

  // Manejo del estado de carga
  useEffect(() => {
    const currentPath = window.location.pathname;

    const isVerifyPath = currentPath.includes('/verify-attendance');
    if (isVerifyPath) {
      setIsLoading(false);
    } else if (headerLoaded && (mainLoaded || currentPath.startsWith("/formulario") || currentPath === "/inscriptions")) {
      setIsLoading(false);
    }
  }, [headerLoaded, mainLoaded, location.pathname]);

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

      {/* Mostrar header y neon line solo si no estamos en la página de verificación */}
      {!isVerifyAttendancePath && (
        <Header onLoadComplete={handleHeaderLoad} />
      )}

      <Routes>
        <Route path="/" element={<Main onLoadComplete={handleMainLoad} />} />
        <Route path="/formulario" element={<SeleccionInscripcion />} />
        
        <Route path="/formulario/:eventoSlug" element={<SeleccionInscripcion />} />

        <Route path="/inscriptions" element={<DashboardAdmin />} />

        {/* Nueva ruta para la verificación de asistencia vía QR */}
        <Route path="/verify-attendance/:eventoId/:inscripcionId/:token" element={<VerifyAttendance />} />

        {/* Redirige cualquier otra URL a la raíz */}
        <Route path="*" element={<Main />} />
      </Routes>

      {!isVerifyAttendancePath && <Footer />}
    </>
  );
};

export const AppWrapper = () => {
  return (
    <AuthProvider>
      <BackHandlerProvider>
        <Router>
          <ScrollToTop />
          <App />
        </Router>
      </BackHandlerProvider>
    </AuthProvider>
  )
}
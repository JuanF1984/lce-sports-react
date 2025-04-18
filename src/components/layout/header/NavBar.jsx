import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from "react"
import '@styles/NavBar.css'
import { useMediaQuery } from 'react-responsive';

import { LogIn } from "./LogIn";

export const NavBar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    const isMobile = useMediaQuery({ maxWidth: 768 })

    const handleNavClick = (e, sectionId) => {
        e.preventDefault();
        setIsOpen(false);

        if (location.pathname !== '/') {
            // Si no estamos en la página principal, primero navegamos a ella
            navigate('/');
            // Esperamos a que la navegación se complete y luego hacemos scroll
            setTimeout(() => {
                const element = document.getElementById(sectionId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        } else {
            // Si ya estamos en la página principal, solo hacemos scroll
            const element = document.getElementById(sectionId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    const handleNavigate = () => {
        // Esta función se pasa como prop y se llamará cuando se navegue desde LogIn
        setIsOpen(false);
    };

    return (
        <nav>
            <div className="menu-container">
                {/* Botón menú hamburguesa */}
                <button className="menu-btn" onClick={toggleMenu}>
                    {/* Si el menú está abierto, mostrar una cruz */}
                    {isOpen ? (
                        <span className="close-btn">&#x2715;</span>
                    ) : (
                        <span className="hamburger-icon">&#x2630;</span>
                    )}
                </button>
                <ul className={`menu ${isOpen ? 'active' : ''}`}>
                    <li>
                        <a href="#reloj" onClick={(e) => handleNavClick(e, 'reloj')}>
                            INSCRIBITE
                        </a>
                    </li>
                    <li>
                        <a href="#torneos" onClick={(e) => handleNavClick(e, 'torneos')}>
                            MEGAEVENTO
                        </a>
                    </li>
                    <li>
                        <a href="#redes" onClick={(e) => handleNavClick(e, 'redes')}>
                            CONTACTO
                        </a>
                    </li>
                    {isMobile && <LogIn onNavigate={handleNavigate} />}
                </ul>
            </div>
        </nav>
    )
}

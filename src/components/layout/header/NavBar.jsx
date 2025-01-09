import { useState } from "react"
import '@styles/NavBar.css'

export const NavBar = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
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
                    <li><a href="#agenda" onClick={() => setIsOpen(false)}>AGENDA</a></li>
                    <li><a href="#buscate" onClick={() => setIsOpen(false)}>GALERÍA</a></li>
                    <li><a href="#contacto" onClick={() => setIsOpen(false)}>CONTACTO</a></li>
                </ul>
            </div>
        </nav>
    )
}

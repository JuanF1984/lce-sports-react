import { useEffect } from 'react'

import '@styles/Header.css'
import logo from '@img/a.png'
import { NavBar } from './NavBar'

export const Header = ({ onLoadComplete }) => {
    useEffect(() => {
        const img = new Image();
        img.src = logo;
        img.onload = () => {
            // Una vez que la imagen se carga, llamamos a onLoadComplete
            onLoadComplete?.();
        };
    }, [onLoadComplete]);

    return (
        <header>
            <div className="header-superior">
                <img src={logo} alt="Logo de LC E-Sports" />
            </div>
            <NavBar />
        </header>
    )
}

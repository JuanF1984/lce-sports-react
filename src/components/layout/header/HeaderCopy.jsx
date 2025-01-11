import { useEffect } from 'react';

import { useMediaQuery } from 'react-responsive';

import '@styles/Header.css';
import logo from '@img/a.png';

import { NavBar } from './NavBar';
import { LogIn } from './LogIn';

export const Header = ({ onLoadComplete }) => {
    const isDesktop = useMediaQuery({ minWidth: 768 })
    
    useEffect(() => {
        const img = new Image();
        img.src = logo;
        img.onload = () => onLoadComplete?.();
    }, [onLoadComplete]);

    

    return (
        <header className="header">
            <div className="header-superior">
                <img src={logo} alt="Logo de LC E-Sports" />
            </div>
            <NavBar />
            {isDesktop&&<LogIn />}
            
        </header>
    );
};

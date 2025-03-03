import { useEffect } from 'react';

import { useMediaQuery } from 'react-responsive';

import { Link } from 'react-router-dom';

import '@styles/Header.css';
import logo from '@img/logo.webp';

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
                <Link to="/">
                    <img src={logo} alt="Logo de LC E-Sports" />
                </Link>
            </div>
            <NavBar />
            {isDesktop && <LogIn />}

        </header>
    );
};

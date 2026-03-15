import { useEffect } from 'react';

import { useMediaQuery } from 'react-responsive';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useBackHandler } from '../../../context/BackHandlerContext';

import '@styles/Header.css';
import logo from '@img/logo.webp';

import { NavBar } from './NavBar';
import { LogIn } from './LogIn';

export const Header = ({ onLoadComplete }) => {
    const isDesktop = useMediaQuery({ minWidth: 769 });
    const location = useLocation();
    const navigate = useNavigate();
    const { backHandler } = useBackHandler();

    const isInnerPage = location.pathname.startsWith('/formulario');

    useEffect(() => {
        const img = new Image();
        img.src = logo;
        img.onload = () => onLoadComplete?.();
    }, [onLoadComplete]);

    if (isInnerPage) {
        return (
            <header className="header header--inner">
                <button className="header-back" onClick={() => backHandler ? backHandler() : navigate(-1)} aria-label="Volver">
                    ←
                </button>
                <Link to="/" className="header-brand header-brand--center">
                    <img src={logo} alt="Logo de LC E-Sports" />
                    <span className="header-brand-name">LC e-SPORTS</span>
                </Link>
                <NavBar />
            </header>
        );
    }

    return (
        <header className="header">
            <div className="header-superior">
                <Link to="/" className="header-brand">
                    <img src={logo} alt="Logo de LC E-Sports" />
                    <span className="header-brand-name">LC e-SPORTS</span>
                </Link>
            </div>
            <NavBar />
            {isDesktop && <LogIn />}
        </header>
    );
};

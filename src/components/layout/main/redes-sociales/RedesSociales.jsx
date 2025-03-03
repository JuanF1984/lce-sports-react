import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInstagram, faTwitch, faFacebook, faTiktok, faDiscord, faWhatsapp } from '@fortawesome/free-brands-svg-icons';

import './RedesSociales.css';
import { faEnvelope } from '@fortawesome/free-regular-svg-icons';

export const RedesSociales = () => {
    return (
        <div className="redes" id="redes">
            <h3>Contacto</h3>
            <ul>
                <li>
                    <a href="https://www.instagram.com/lcesports/" target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faInstagram} />
                    </a>
                </li>
                <li>
                    <a href="https://www.twitch.tv/lc_esports"
                        target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faTwitch} />
                    </a>
                </li>
                <li>
                    <a href="https://www.facebook.com/profile.php?id=61568456592154" target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faFacebook} />
                    </a>
                </li>
                <li>
                    <a href="https://www.tiktok.com/@Lc.esports"
                        target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faTiktok} />
                    </a>
                </li>
                <li>
                    <a href="https://discord.com/channels/677928250801913867/747705285757501442" target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faDiscord} />
                    </a>
                </li>
                <li>
                    <a href="https://wa.me/message/WNKWNX2EKUZZO1?fbclid=PAZXh0bgNhZW0CMTEAAaZi37SDpUKEBiNo6usbFZnGDVwPg3pBkX_j_ABOLKhyOiikgXwB31YVOSI_aem_xrNGXLQPfUGLfKrvOo7eXA" target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faWhatsapp} />
                    </a>
                </li>
                <li>
                    <a href="mailto:lcesports00@gmail.com" target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faEnvelope} />
                    </a>
                </li>
            </ul>
        </div>
    );
};

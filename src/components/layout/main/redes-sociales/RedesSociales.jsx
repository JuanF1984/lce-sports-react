import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInstagram, faTwitch, faFacebook, faTiktok, faDiscord } from '@fortawesome/free-brands-svg-icons';

import './RedesSociales.css';

export const RedesSociales = () => {
    return (
        <div className="redes">
            <h3>Sumate</h3>
            <ul>
                <li>
                    <a href="https://www.instagram.com/lcesports/" target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faInstagram} />
                    </a>
                </li>
                <li>
                    <a href="https://www.twitch.tv/lc_esports?fbclid=IwY2xjawFQK9hleHRuA2FlbQIxMAABHfxpL5En2ZA4zjWnz5tfyjI3hcTMf_I9US_DYZmPTCuPMSTVB3LDiTyfMw_aem_85z93WneKEMjAhc-GyUDaA"
                        target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faTwitch} />
                    </a>
                </li>
                <li>
                    <a href="https://www.facebook.com/profile.php?id=100064599417242" target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faFacebook} />
                    </a>
                </li>
                <li>
                    <a href="https://www.tiktok.com/@Lc.esports?fbclid=IwY2xjawFzaxFleHRuA2FlbQIxMAABHYWYlYMyMt_OY31NSZH6hDjwdzIo4T0AH08fwn0a_trkP2d9X8kgF-ve_g_aem_eBW1x3gYjJFuLWtjfqIB1w"
                        target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faTiktok} />
                    </a>
                </li>
                <li>
                    <a href="https://discord.com/channels/677928250801913867/747705285757501442" target="_blank" rel="noopener noreferrer">
                        <FontAwesomeIcon icon={faDiscord} />
                    </a>
                </li>
            </ul>
        </div>
    );
};

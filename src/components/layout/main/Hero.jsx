import { useEffect } from 'react';

import img1 from '@img/hero/hero_img1.jpg'

import '@styles/Hero.css'

export const Hero = ({ onLoadComplete }) => {
  useEffect(() => {
    const img = new Image();
    img.src = img1;
    img.onload = () => {
      onLoadComplete?.();
    };
  }, [onLoadComplete]);

  return (
    <section className="hero">
      <img src={img1} title="Imagen de MegaEvento Gamer" alt="Imagen de un evento Gamer organizado por LC E-Sport" />
      <div className="hero-text">
        <h1>LC E-Sports</h1>
        <p>
          Una nueva manera de disfrutar ser Gamer. Conocenos
        </p>
        <button>Let's Go</button>
      </div>

    </section>
  )
}

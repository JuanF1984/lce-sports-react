import React, { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import './CarrouselImagenes.css';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

// Import required modules
import { Autoplay, Pagination, Navigation } from 'swiper/modules';

export const Carrusel = ({ onLoadComplete }) => {
  const [images, setImages] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const swiperRef = useRef(null);

  useEffect(() => {
    const loadImages = async () => {
      const imagesContext = import.meta.glob('../../../../assets/img/carrousel-buscate/*.{png,jpg,jpeg,svg}', { eager: true });
      const loadedImages = Object.values(imagesContext).map((img) => img.default || img);
      setImages(loadedImages);
    };

    loadImages();
  }, []);

  useEffect(() => {
    if (images.length > 0) {
      onLoadComplete?.();
    }
  }, [images.length, onLoadComplete]);

  const handleImageClick = (index) => {
    setCurrentImageIndex(index);
    setModalOpen(true);
    swiperRef.current?.autoplay.stop(); // Pausa el autoplay al abrir el modal
  };

  const handleModalClose = () => {
    setModalOpen(false);
    swiperRef.current?.autoplay.start(); // Reanuda el autoplay al cerrar el modal
  };

  const handleNext = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <section className="carrousel" id="buscate">
      <h2>Buscate</h2>

      {images.length > 0 ? (
        <Swiper
          spaceBetween={0}
          slidesPerView={2}
          breakpoints={{
            1024: {
              slidesPerView: 4, 
            },
            768: {
              slidesPerView: 3, 
            },           
          }}
          centeredSlides={true}
          autoplay={{
            delay: 1500,
            disableOnInteraction: false,
          }}
          pagination={{
            clickable: true,
          }}
          navigation={true}
          loop={true}
          modules={[Autoplay, Pagination, Navigation]}
          className="mySwiper"
          onSlideChange={(swiper) => setCurrentImageIndex(swiper.realIndex)}
          onSwiper={(swiper) => (swiperRef.current = swiper)} // Guarda la referencia al Swiper
        >
          {images.map((image, index) => (
            <SwiperSlide key={index}>
              <img
                src={image}
                alt={`Imagen ${index + 1}`}
                onClick={() => handleImageClick(index)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <p>Cargando imágenes...</p>
      )}

      <Modal
        image={images[currentImageIndex]}
        onClose={handleModalClose}
        onNext={handleNext}
        onPrev={handlePrev}
        isOpen={modalOpen}
      />
    </section>
  );
};

const Modal = ({ image, onClose, onNext, onPrev, isOpen }) => {
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [isOpen, onNext, onPrev, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'flex' }}>
      <span className="close" onClick={onClose}>&times;</span>
      <a className="prev" onClick={onPrev}>&#10094;</a>
      <img className="modal-content" src={image} alt="Modal" />
      <a className="next" onClick={onNext}>&#10095;</a>
    </div>
  );
};

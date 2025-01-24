import React, { useState, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { CarruselCommonModal } from './CarruselCommonModal';

import './CarruselStyle.css';

export const CarruselCommon = ({
  items,
  title
}) => {
  const carouselItems = items.length < 8 ? [...items, ...items, ...items, ...items] : items
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const swiperRef = useRef(null);

  const handleItemClick = (index) => {
    setCurrentIndex(index % items.length);
    setModalOpen(true);
    swiperRef.current?.autoplay.stop();
  };

  const handleModalClose = () => {
    setModalOpen(false);
    swiperRef.current?.autoplay.start();
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  return (
    <section className="carrousel" id="buscate">
      {title && <h2>{title}</h2>}

      <Swiper
        spaceBetween={0}
        slidesPerView={1}
        breakpoints={{
          // Cuando el ancho de pantalla sea >= 640px
          640: {
            slidesPerView: 2,
          },
          // Cuando el ancho de pantalla sea >= 768px
          768: {
            slidesPerView: 3,
          },
          // Cuando el ancho de pantalla sea >= 1024px
          1024: {
            slidesPerView: 4,
          }
        }}
        centeredSlides={true}
        autoplay={{
          delay: 1500,
          disableOnInteraction: false,
        }}
        pagination={{ clickable: true }}
        navigation={true}
        loop={items.length >= 4}
        modules={[Autoplay, Pagination, Navigation]}
        className="mySwiper"
        onSwiper={(swiper) => (swiperRef.current = swiper)}
      >
        {carouselItems.map((item, index) => (
          <SwiperSlide
            key={index}
            className="cursor-pointer"
            onClick={() => handleItemClick(index)}
          >
            {item}
          </SwiperSlide>
        ))}
      </Swiper>

      <CarruselCommonModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onNext={handleNext}
        onPrev={handlePrev}
      >
        {items[currentIndex]}
      </CarruselCommonModal>
    </section>
  );

}


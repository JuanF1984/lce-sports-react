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
  title,
  slidesPerView = 2,
  breakpoints = {
    1024: { slidesPerView: 4 },
    768: { slidesPerView: 3 }
  }
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const swiperRef = useRef(null);

  const handleItemClick = (index) => {
    setCurrentIndex(index);
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
        slidesPerView={slidesPerView}
        breakpoints={breakpoints}
        centeredSlides={true}
        autoplay={{
          delay: 1500,
          disableOnInteraction: false,
        }}
        pagination={{ clickable: true }}
        navigation={true}
        loop={true}
        modules={[Autoplay, Pagination, Navigation]}
        className="mySwiper"
        onSwiper={(swiper) => (swiperRef.current = swiper)}
      >
        {items.map((item, index) => (
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


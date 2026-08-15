import React, { useEffect, useRef, useState } from 'react';
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
  id,
}) => {
  const carouselItems = items.length < 8 ? [...items, ...items, ...items, ...items] : items
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const swiperRef = useRef(null);

  // No montar el Swiper (ni sus imágenes) hasta que la sección esté cerca del
  // viewport. `lazyPreloadPrevNext` fuerza descargas apenas Swiper inicializa,
  // así que sin este gate el carrusel bajaría varias imágenes aunque el
  // usuario nunca llegue a scrollear hasta acá — justo lo que se quiere
  // evitar para Cached Egress. `rootMargin` amplio para que la primera imagen
  // ya esté lista cuando el usuario realmente lo vea.
  const [shouldMount, setShouldMount] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    if (shouldMount) return;
    const el = sectionRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShouldMount(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldMount(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldMount]);

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
    <section className="carrousel" ref={sectionRef} {...(id ? { id } : {})}>
      {title && <h2>{title}</h2>}

      {shouldMount ? (
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
          // Los slides fuera del viewport se ubican con `transform`, así que el
          // IntersectionObserver nativo de `loading="lazy"` no los detecta hasta
          // que ya están casi encima — con autoplay eso deja el próximo slide en
          // skeleton infinito. `lazyPreloadPrevNext` es un parámetro nativo de
          // Swiper (no requiere el módulo Lazy, deprecado desde Swiper 9): para
          // cada slide dentro de este rango de la actual, le saca el atributo
          // `loading="lazy"` a su <img> para forzar la descarga inmediata, sin
          // tocar los slides más lejanos. En 1: con autoplay de 1500ms alcanza
          // de sobra para que el próximo slide no llegue tarde, y ya no hace
          // falta más margen porque el propio Swiper no monta hasta estar
          // cerca del viewport (ver `shouldMount` arriba) — ver docs de
          // Swiper, parámetro `lazyPreloadPrevNext`.
          lazyPreloadPrevNext={1}
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
      ) : (
        <div className="carrousel-placeholder" aria-hidden="true">
          <div className="carrusel-img-wrap">
            <div className="carrusel-img-skeleton" />
          </div>
        </div>
      )}

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


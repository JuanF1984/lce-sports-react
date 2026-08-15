import { useEffect, useRef, useState } from "react";
import { CarruselCommon } from "../carruselCommon/CarruselCommon"

// Estado de carga individual por imagen (skeleton shimmer). `imgRef.complete`
// cubre el caso de imagen ya cacheada por el navegador: si al montar ya está
// lista, el evento `load` puede no llegar a dispararse (o ya haberlo hecho
// antes de que React conecte el listener), y el skeleton quedaría visible
// para siempre sin este chequeo.
const CarruselImageItem = ({ item, onImageLoad }) => {
    const [loaded, setLoaded] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => {
        // naturalWidth > 0 además de `complete` para no confundir "ya
        // resuelto con error" (complete=true, naturalWidth=0) con
        // "realmente cargada".
        if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
            setLoaded(true);
        }
    }, []);

    const handleLoad = (e) => {
        setLoaded(true);
        onImageLoad?.(e);
    };

    // Destraba el skeleton (efecto visual) pero deja constancia del error en
    // consola — no lo escondemos en silencio detrás de un skeleton que nunca
    // se resuelve. A propósito NO llama a onImageLoad acá para no alterar el
    // gate de carga que ya usaba Main.jsx.
    const handleError = () => {
        console.error('Error al cargar imagen del carrusel:', item.image);
        setLoaded(true);
    };

    return (
        <div className="imgTxtContainer">
            <div className="carrusel-img-wrap">
                {!loaded && <div className="carrusel-img-skeleton" aria-hidden="true" />}
                <img
                    ref={imgRef}
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    onLoad={handleLoad}
                    onError={handleError}
                    className={`carrusel-img${loaded ? ' carrusel-img--loaded' : ''}`}
                />
            </div>

            <h4>{item.title}</h4>
            <p>{item.description}</p>
        </div>
    );
};

export const CarruselTextAndImage = ({ imagesAndText, title, onImageLoad }) => {

    // El Swiper (y sus imágenes) ahora recién monta cuando el carrusel se
    // acerca al viewport (ver CarruselCommon.jsx) — si el usuario nunca
    // scrollea hasta ahí, ninguna imagen dispara `onLoad`. `onImageLoad` acá
    // es el gate de "Home terminó de cargar" que usa Main.jsx (vía
    // useImageLoading, con imageCount=1 — cualquier llamada lo resuelve), así
    // que se dispara una sola vez al montar el carrusel para no dejar el
    // splash de carga esperando por imágenes fuera de pantalla.
    useEffect(() => {
        onImageLoad?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const slides = imagesAndText.map((item, index) => (
        <CarruselImageItem key={index} item={item} onImageLoad={onImageLoad} />
    ));

    return <CarruselCommon items={slides} title={title} id="torneos"/>;
};

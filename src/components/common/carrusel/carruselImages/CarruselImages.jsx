import { CarruselCommon } from "../carruselCommon/CarruselCommon"

export const CarruselImages = ({ images, title, onImageLoad }) => {
    const imageItems = images.map((src, index) => (
        <img
            key={index}
            src={src}
            alt={`Imagen ${index + 1}`}
            onLoad={onImageLoad}
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
            }}
        />
    ));

    return <CarruselCommon items={imageItems} title={title} id="buscate"/>;
};


import { CarruselCommon } from "../carruselCommon/CarruselCommon"

export const CarruselTextAndImage = ({ imagesAndText, title, onImageLoad }) => {


    const slides = imagesAndText.map((item, index) => (
        <div className="imgTxtContainer" key={index}>
            <img
                src={item.image}
                alt={item.title}
                onLoad={onImageLoad}
                style={{
                    width: '80%',
                    height: '80%',
                    objectFit: 'cover',
                }}
            />

            <h4>{item.title}</h4>
            <p>{item.description}</p>

        </div>
    ));


    return <CarruselCommon items={slides} title={title} />;
};
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Solución para el problema de los íconos en Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const BuenosAiresMap = () => {
    const [geoJsonData, setGeoJsonData] = useState(null);

    // Ciudades principales
    const cities = [
        { name: "La Plata", position: [-34.92, -57.95], info: "Ciudad de los niños" },
        { name: "Mar del Plata", position: [-38.00, -57.56], info: "Juegos Bonaerenses" },
        { name: "Luján", position: [-34.5703, -59.1036], info: "Torneo en Polideportivo" },
        { name: "Monte Hermoso", position: [-38.9896, -61.2963], info: "Torneo en la costa" },
    ];

    // Estilo para el GeoJSON
    const geoJSONStyle = {
        fillColor: '#0ea5e9',
        weight: 2,
        opacity: 1,
        color: '#0369a1',
        fillOpacity: 0.7
    };

    // Carga del archivo GeoJSON
    useEffect(() => {
        fetch('/buenos-aires.json')
            .then(response => response.json())
            .then(data => {
                console.log("GeoJSON data loaded:", data);
                setGeoJsonData(data);
            })
            .catch(error => {
                console.error("Error al cargar el GeoJSON:", error);
            });
    }, []);

    // Función para el evento GeoJSON
    const onEachFeature = (feature, layer) => {
        if (feature.properties) {
            layer.bindPopup(feature.properties.NAME_1 || "Provincia de Buenos Aires");
        }
    };

    // Si el DOM no está disponible aún, no renderizamos el mapa
    if (typeof window === 'undefined') {
        return <div>Cargando...</div>;
    }

    return (
        <div className="flex flex-col w-full max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Provincia de Buenos Aires</h2>

            {/* Contenedor del mapa con altura explícita */}
            <div style={{ height: '500px', width: '100%' }} className="rounded-xl overflow-hidden shadow-lg border border-gray-300">
                <MapContainer
                    center={[-36.6, -59.5]}
                    zoom={6}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {geoJsonData && (
                        <GeoJSON
                            data={geoJsonData}
                            style={geoJSONStyle}
                            onEachFeature={onEachFeature}
                        />
                    )}

                    {cities.map(city => (
                        <Marker
                            key={city.name}
                            position={city.position}
                        >
                            <Popup>
                                <div>
                                    <h3 className="font-bold">{city.name}</h3>
                                    <p>{city.info}</p>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {/* Leyenda */}
            <div className="mt-4 p-4 bg-white rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Ciudades principales</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {cities.map(city => (
                        <div key={city.name} className="flex items-center">
                            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                            <span className="text-sm text-gray-600">{city.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BuenosAiresMap;
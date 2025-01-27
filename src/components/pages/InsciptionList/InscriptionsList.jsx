import React, { useEffect, useState } from 'react';
import supabase from '../../../utils/supabase';

import { FilterableList } from './FilterableList';

import { ExportToExcelButton } from './ExportToExcelButton ';

import '../../../styles/InscriptionsList.css';

const InscriptionsList = () => {
  const [inscriptions, setInscriptions] = useState([]);
  const [events, setEvents] = useState([]);
  const [filteredInscriptions, setFilteredInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const headerTable = [
    'Nombre',
    'Apellido',
    'Edad',
    'Celular',
    'Juegos',
    'Localidad',
    'Evento'
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: inscriptionsData, error: inscriptionsError } = await supabase
          .from("inscriptions")
          .select("nombre, apellido, edad, celular, juegos, localidad, id_evento, created_at");

        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("id, fecha_inicio, localidad");

        if (inscriptionsError || eventsError) {
          console.error("Error fetching data:", inscriptionsError || eventsError);
        } else {
          setInscriptions(inscriptionsData);
          setEvents(eventsData);
          setFilteredInscriptions(inscriptionsData); // Mostrar todas las inscripciones inicialmente
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleFilterUpdate = (data) => {
    setFilteredInscriptions(data);
  };

  const getEventDetails = (eventId) => {
    const event = events.find((e) => e.id === eventId);
    return event ? `${event.fecha_inicio} - ${event.localidad}` : "Evento no encontrado";
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  if (inscriptions.length === 0) {
    return <p>No inscriptions found.</p>;
  }

  return (
    <main>
      <div className="inscriptions-container">
        <FilterableList inscriptions={inscriptions} events={events} onFilter={handleFilterUpdate} />
        <ExportToExcelButton
          data={filteredInscriptions}
          getEventDetails={getEventDetails}
          headerTable={headerTable}
        />
        <h2>Lista de Inscripciones</h2>
        <table className="inscriptions-table">
          <thead>
            <tr>
              {headerTable.map((header, index) => (
                <th key={index}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredInscriptions.map((inscription, index) => (
              <tr key={index}>
                <td>{inscription.nombre}</td>
                <td>{inscription.apellido}</td>
                <td>{inscription.edad}</td>
                <td>{inscription.celular}</td>
                <td>{inscription.juegos}</td>
                <td>{inscription.localidad}</td>
                <td>{getEventDetails(inscription.id_evento)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default InscriptionsList;

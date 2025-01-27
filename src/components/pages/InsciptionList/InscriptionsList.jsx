import React, { useEffect, useState } from 'react';
import supabase from '../../../utils/supabase';

import { FilterableList } from './FilterableList';

import '../../../styles/InscriptionsList.css';

const InscriptionsList = () => {
  const [inscriptions, setInscriptions] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInscriptions = async () => {
      try {
        const { data, error } = await supabase
          .from('inscriptions')
          .select('nombre, apellido, edad, celular, juegos, localidad, id_evento');

        if (error) {
          console.error('Error fetching inscriptions:', error);
        } else {
          setInscriptions(data);
          setFilteredData(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInscriptions();
  }, []);

  const handleFilter = (eventId) => {
    if (eventId) {
      setFilteredData(inscriptions.filter((insc) => insc.id_evento === eventId));
    } else {
      setFilteredData(inscriptions);
    }
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
        <FilterableList onFilterChange={handleFilter} />
        <h2>Lista de Inscripciones</h2>
        <table className="inscriptions-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Apellido</th>
              <th>Edad</th>
              <th>Celular</th>
              <th>Juegos</th>
              <th>Localidad</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((inscription, index) => (
              <tr key={index}>
                <td>{inscription.nombre}</td>
                <td>{inscription.apellido}</td>
                <td>{inscription.edad}</td>
                <td>{inscription.celular}</td>
                <td>{inscription.juegos}</td>
                <td>{inscription.localidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default InscriptionsList;

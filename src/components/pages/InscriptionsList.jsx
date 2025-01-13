import React, { useEffect, useState } from 'react';
import supabase from '../../utils/supabase';

import '../../styles/InscriptionsList.css';

const InscriptionsList = () => {
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInscriptions = async () => {
      try {
        const { data, error } = await supabase
          .from('inscriptions')
          .select('nombre, apellido, celular, juegos, localidad');
        
        if (error) {
          console.error('Error fetching inscriptions:', error);
        } else {
          setInscriptions(data);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInscriptions();
  }, []);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (inscriptions.length === 0) {
    return <p>No inscriptions found.</p>;
  }

  return (
    <div className="inscriptions-container">
      <h2>Lista de Inscripciones</h2>
      <table className="inscriptions-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Apellido</th>
            <th>Celular</th>
            <th>Juegos</th>
            <th>Localidad</th>
          </tr>
        </thead>
        <tbody>
          {inscriptions.map((inscription, index) => (
            <tr key={index}>
              <td>{inscription.nombre}</td>
              <td>{inscription.apellido}</td>
              <td>{inscription.celular}</td>
              <td>{inscription.juegos}</td>
              <td>{inscription.localidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InscriptionsList;

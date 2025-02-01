import React, { useEffect, useState } from 'react';
import supabase from '../../../../utils/supabase';

import { FilterSystem } from './FilterSystem';

import { ExportToExcelButton } from './ExportToExcelButton ';

import { AddTournamentForm } from './AddTournamentForm';

import '../../../../styles/InscriptionsList.css';

const InscriptionsList = () => {
  const [inscriptions, setInscriptions] = useState([]);
  const [events, setEvents] = useState([]);
  const [filteredInscriptions, setFilteredInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);

  const headerTable = [
    'Nombre',
    'Apellido',
    'Edad',
    'Celular',
    'Localidad',
    'Juegos',
    'Evento'
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: inscriptionsWithGames, error: inscriptionsError } = await supabase
          .from("inscriptions")
          .select(`
            nombre,
            apellido,
            edad,
            celular,
            localidad,
            id_evento,
            created_at,
            games_inscriptions (
              game:games (
                id,
                game_name
              )
            )
          `);

        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("id, fecha_inicio, localidad");

        const { data: gamesData, error: gamesError } = await supabase
          .from("games")
          .select("id, game_name");

        if (inscriptionsError || eventsError || gamesError) {
          console.error("Error fetching data:", inscriptionsError || eventsError || gamesError);
        } else {

          const formattedInscriptions = inscriptionsWithGames.map(inscription => {
            const gamesArray = inscription.games_inscriptions || [];
            const games = gamesArray
              .map(gi => gi.game?.game_name)
              .filter(Boolean)
              .join(', ');

            return {
              ...inscription,
              juegos: games || 'Sin juegos registrados'
            };
          });

          setInscriptions(formattedInscriptions);
          setEvents(eventsData);
          setGames(gamesData);
          setFilteredInscriptions(formattedInscriptions); // Mostrar todas las inscripciones inicialmente
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);


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
        <FilterSystem
          inscriptions={inscriptions}
          events={events}
          games={games}
          onFilter={setFilteredInscriptions}
        />
        <ExportToExcelButton
          data={filteredInscriptions}
          getEventDetails={getEventDetails}
          headerTable={headerTable}
        />
        
        <h2 className='titulos-admin'>Lista de Inscripciones</h2>
        <table className="inscriptions-table">
          <thead>
            <tr>
              {headerTable.map((header, index) => (
                <th key={index}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredInscriptions.length > 0 ? (
              filteredInscriptions.map((inscription, index) => (
                <tr key={index}>
                  <td>{inscription.nombre}</td>
                  <td>{inscription.apellido}</td>
                  <td>{inscription.edad}</td>
                  <td>{inscription.celular}</td>
                  <td>{inscription.localidad}</td>
                  <td>{inscription.juegos}</td>
                  <td>{getEventDetails(inscription.id_evento)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headerTable.length} style={{ textAlign: "center", padding: "10px" }}>
                  ⚠️ No hay inscripciones disponibles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
};



export default InscriptionsList;

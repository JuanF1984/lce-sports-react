import React, { useEffect, useState } from 'react';
import supabase from '../../../../utils/supabase';

import { FilterSystem } from './FilterSystem';

import { ExportToExcelButton } from './ExportToExcelButton ';

import { useEvents } from '../../../../hooks/useEvents';

import '../../../../styles/InscriptionsList.css';

const InscriptionsList = () => {
  const [inscriptions, setInscriptions] = useState([]);
  const [filteredInscriptions, setFilteredInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);

  const { eventsData, eventsError, loadingError } = useEvents();



  const headerTable = [
    'Nombre',
    'Apellido',
    'Edad',
    'Celular',
    'Localidad',
    'Juegos',
    'Evento',
    'Equipo'
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
            team_name,
            created_at,
            games_inscriptions (
              game:games (
                id,
                game_name
              )
            )
          `)
          .order('team_name', { ascending: false });


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
    if (eventsError || loadingError) {
      return "Error al cargar los eventos";
    }

    if (!eventsData || !Array.isArray(eventsData)) {
      return "Cargando eventos...";
    }

    const event = eventsData.find((e) => e.id === eventId);
    return event
      ? `${event.fecha_inicio} - ${event.localidad}`
      : "Evento no encontrado";
  };


  if (loading) {
    return <p>Loading...</p>;
  }

  if (inscriptions.length === 0) {
    return <p>No inscriptions found.</p>;
  }

  return (
    <div className="inscriptions-container">
      {eventsData ? (
        <FilterSystem
          inscriptions={inscriptions}
          events={eventsData}
          games={games}
          onFilter={setFilteredInscriptions}
        />
      ) : (
        <div>Cargando eventos...</div>
      )}
      <div className="inscriptions-header">
        <h2 className='titulos-admin'>Lista de Inscripciones</h2>
        <div className="inscriptions-count">
          Total: <strong>{filteredInscriptions.length}</strong> inscripciones
          {inscriptions.length !== filteredInscriptions.length && (
            <span> (de {inscriptions.length} totales)</span>
          )}
        </div>
      </div>

      <ExportToExcelButton
        data={filteredInscriptions}
        getEventDetails={getEventDetails}
        headerTable={headerTable}
      />

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
                <td>{inscription.team_name}</td>
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

      <div className="mobile-notice">
        <small>* En dispositivos móviles solo se muestran apellido, nombre y juegos</small>
      </div>
    </div>
  );
};

export default InscriptionsList;
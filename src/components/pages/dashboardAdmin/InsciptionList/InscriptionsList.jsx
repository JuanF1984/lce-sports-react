import React, { useEffect, useState } from 'react';
import supabase from '../../../../utils/supabase';

import { FilterSystem } from './FilterSystem';

import { ExportToExcelButton } from './ExportToExcelButton ';

import { useEvents } from '../../../../hooks/useEvents';

import { useProximoEvento } from '../../../../hooks/useProximoEvento';

import '../../../../styles/InscriptionsList.css';

const InscriptionsList = () => {
  const [inscriptions, setInscriptions] = useState([]);
  const [filteredInscriptions, setFilteredInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [uniquePlayersCount, setUniquePlayersCount] = useState(0);
  const { proximoEvento, loading: loadingProximoEvento } = useProximoEvento();

  const { eventsData, eventsError, loadingError } = useEvents();

  const [activeFilters, setActiveFilters] = useState({
    eventId: "",
    startDate: "",
    endDate: "",
    gameId: "",
  });

  const headerTable = [
    'Nombre',
    'Apellido',
    'Edad',
    'Celular',
    'Email',
    'Localidad',
    'Juegos',
    'Evento',
    'Equipo'
  ];

  const filterDuplicatesByPersonAndGame = (inscriptions) => {
    // Mapa donde la clave es una combinación de email+nombre+apellido+juego
    const uniqueKeyMap = new Map();

    return inscriptions.filter(inscription => {
      // Normalizar los datos para la comparación
      const emailLowerCase = inscription.email.toLowerCase().trim();
      const fullName = `${inscription.nombre.toLowerCase().trim()}-${inscription.apellido.toLowerCase().trim()}`;

      // Obtener juegos como una cadena ordenada
      const juegos = inscription.juegos || 'Sin juegos registrados';

      // Crear una clave única que incluya persona+juegos
      const uniqueKey = `${emailLowerCase}|${fullName}|${juegos}`;

      // Si no hemos visto esta combinación antes, la aceptamos
      if (!uniqueKeyMap.has(uniqueKey)) {
        uniqueKeyMap.set(uniqueKey, true);
        return true;
      }

      // Si ya tenemos esta combinación exacta, la rechazamos (es un duplicado)
      return false;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Obtener los datos de inscripciones y juegos como lo haces actualmente
        const { data: inscriptionsWithGames, error: inscriptionsError } = await supabase
          .from("inscriptions")
          .select(`
            nombre,
            apellido,
            edad,
            celular,
            email,
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
          // Procesar las inscripciones como lo haces actualmente
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

          // Guardar todos los datos completos
          setInscriptions(formattedInscriptions);
          setGames(gamesData);

          // NUEVO: Verificar si tenemos proximoEvento disponible
          if (proximoEvento?.id) {
            // Crear un filtro inicial con el ID del último evento
            const initialFilters = {
              eventId: proximoEvento.id,
              startDate: "",
              endDate: "",
              gameId: ""
            };

            // Filtrar las inscripciones para mostrar solo las del último evento
            const inscriptionsDelUltimoEvento = formattedInscriptions.filter(
              inscription => inscription.id_evento === proximoEvento.id
            );

            // Actualizar el estado con las inscripciones filtradas
            setFilteredInscriptions(filterDuplicatesByPersonAndGame(inscriptionsDelUltimoEvento));

            // Actualizar los filtros activos
            setActiveFilters(initialFilters);

            // Calcular la cantidad de jugadores únicos del evento filtrado
            const uniqueEmailsDelEvento = new Set(
              inscriptionsDelUltimoEvento.map(inscription => inscription.email)
            );
            setUniquePlayersCount(uniqueEmailsDelEvento.size);
          } else {
            // Si no hay proximoEvento, mostrar todas las inscripciones
            setFilteredInscriptions(filterDuplicatesByPersonAndGame(formattedInscriptions));

            // Calcular la cantidad de jugadores únicos de todas las inscripciones
            const uniqueEmails = new Set(formattedInscriptions.map(inscription => inscription.email));
            setUniquePlayersCount(uniqueEmails.size);
          }
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [proximoEvento]); // IMPORTANTE: Agregar proximoEvento como dependencia

  // Actualizar el conteo de jugadores únicos cuando cambian las inscripciones filtradas
  useEffect(() => {
    if (filteredInscriptions.length > 0) {
      const uniqueEmails = new Set(filteredInscriptions.map(inscription => inscription.email));
      setUniquePlayersCount(uniqueEmails.size);
    } else {
      setUniquePlayersCount(0);
    }
  }, [filteredInscriptions]);

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
          onFiltersChange={setActiveFilters}
          initialFilters={activeFilters}
        />
      ) : (
        <div>Cargando eventos...</div>
      )}
      <div className="inscriptions-header">
        <h2 className='titulos-admin'>Lista de Inscripciones</h2>
        <div className="inscriptions-count">
          Total: <strong>{uniquePlayersCount}</strong> emails únicos
          {filteredInscriptions.length !== uniquePlayersCount && (
            <span> (con {filteredInscriptions.length} inscripciones)</span>
          )}
          {activeFilters.eventId ? (
            <span> del evento seleccionado</span>
          ) : (
            inscriptions.length !== filteredInscriptions.length && (
              <span> (de {inscriptions.length} inscripciones totales)</span>
            )
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
                <td>{inscription.email}</td>
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
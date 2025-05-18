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

  // Nueva función para cargar inscripciones de un evento específico
  const fetchInscriptionsByEvent = async (eventId) => {
    if (!eventId) {
      setInscriptions([]);
      setFilteredInscriptions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Consulta solo las inscripciones del evento seleccionado
      const { data: inscriptionsData, error: inscriptionsError } = await supabase
        .from("inscriptions")
        .select(`
          *,
          games_inscriptions (
            game:games (
              id,
              game_name
            )
          )
        `)
        .eq('id_evento', eventId) // Solo cargamos las inscripciones del evento seleccionado
        .order('team_name', { ascending: false }) // Ordenar por team_name (NULL primero)

      if (inscriptionsError) {
        console.error("Error al cargar inscripciones:", inscriptionsError);
        return;
      }

      // Procesamos los datos como antes
      const formattedInscriptions = inscriptionsData.map(inscription => {
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

      // Filtrado de duplicados - Mostramos solo inscripciones únicas
      const uniqueInscriptions = filterDuplicatesByPersonAndGame(formattedInscriptions);

      // Actualizamos el estado
      setInscriptions(formattedInscriptions); // Guardamos todas las inscripciones para filtrado
      setFilteredInscriptions(uniqueInscriptions); // Mostramos solo las únicas

      // Calculamos los emails únicos
      const uniqueEmails = new Set(uniqueInscriptions.map(inscription => inscription.email));
      setUniquePlayersCount(uniqueEmails.size);

    } catch (error) {
      console.error("Error inesperado al cargar inscripciones:", error);
    } finally {
      setLoading(false);
    }
  };

  // Función para filtrar duplicados por persona y juego
  const filterDuplicatesByPersonAndGame = (inscriptions) => {
    // Mapa donde la clave es una combinación de email+nombre+apellido+juego+equipo
    const uniqueKeyMap = new Map();

    return inscriptions.filter(inscription => {
      // Normalizar los datos para la comparación
      const emailLowerCase = inscription.email?.toLowerCase().trim() || '';
      const fullName = `${inscription.nombre?.toLowerCase().trim() || ''}-${inscription.apellido?.toLowerCase().trim() || ''}`;

      // Obtener juegos como una cadena
      const juegos = inscription.juegos || 'Sin juegos registrados';
      const teamName = inscription.team_name || '';

      // Crear una clave única que incluya persona+juegos+equipo
      const uniqueKey = `${emailLowerCase}|${fullName}|${juegos}|${teamName}`;

      // Si no hemos visto esta combinación antes, la aceptamos
      if (!uniqueKeyMap.has(uniqueKey)) {
        uniqueKeyMap.set(uniqueKey, true);
        return true;
      }

      // Si ya tenemos esta combinación exacta, la rechazamos (es un duplicado)
      return false;
    });
  };

  // Efecto para cargar los juegos disponibles
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const { data: gamesData, error: gamesError } = await supabase
          .from("games")
          .select("*");

        if (gamesError) {
          console.error("Error al cargar juegos:", gamesError);
          return;
        }

        setGames(gamesData);
      } catch (error) {
        console.error("Error inesperado al cargar juegos:", error);
      }
    };

    fetchGames();
  }, []); // Solo se ejecuta una vez al montar el componente

  // Efecto para establecer el evento inicial y cargar sus inscripciones
  useEffect(() => {
    if (loadingProximoEvento) {
      return; // Esperamos a que termine de cargar
    }

    // Si tenemos proximoEvento, lo establecemos como filtro inicial
    if (proximoEvento?.id) {
      // Establecemos el filtro inicial
      const initialFilters = {
        eventId: proximoEvento.id,
        startDate: "",
        endDate: "",
        gameId: ""
      };

      setActiveFilters(initialFilters);

      // Cargamos inscripciones específicamente para este evento
      fetchInscriptionsByEvent(proximoEvento.id);
    } else {
      setLoading(false);
    }
  }, [proximoEvento, loadingProximoEvento]);

  // Manejar cambios en los filtros
  const handleFiltersChange = (newFilters) => {
    setActiveFilters(newFilters);

    // Si cambió el evento, cargamos nuevas inscripciones
    if (newFilters.eventId !== activeFilters.eventId) {
      fetchInscriptionsByEvent(newFilters.eventId);
    }
  };

  // Función para aplicar otros filtros (fecha, juego) a las inscripciones ya cargadas
  const applyFilters = (filteredResults) => {
    // Aplicamos filtrado de duplicados a los resultados filtrados
    const uniqueFilteredResults = filterDuplicatesByPersonAndGame(filteredResults);
    setFilteredInscriptions(uniqueFilteredResults);

    // Actualizar contador de emails únicos
    const uniqueEmails = new Set(uniqueFilteredResults.map(inscription => inscription.email));
    setUniquePlayersCount(uniqueEmails.size);
  };

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
    return <p>Cargando inscripciones...</p>;
  }

  // Si no hay evento seleccionado, mostramos un mensaje
  if (!activeFilters.eventId) {
    return (
      <div className="inscriptions-container">
        <h2 className='titulos-admin'>Lista de Inscripciones</h2>
        {eventsData ? (
          <div>
            <FilterSystem
              inscriptions={[]} // No hay inscripciones aún
              events={eventsData}
              games={games}
              onFilter={applyFilters}
              onFiltersChange={handleFiltersChange}
              initialFilters={activeFilters}
            />

            <div className="inscriptions-header">
              <div className="inscriptions-count">
                Selecciona un evento para ver las inscripciones
              </div>
            </div>

            <table className="inscriptions-table">
              <thead>
                <tr>
                  {headerTable.map((header, index) => (
                    <th key={index}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={headerTable.length} style={{ textAlign: "center", padding: "10px" }}>
                    Por favor, selecciona un evento para ver sus inscripciones.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div>Cargando eventos...</div>
        )}
      </div>
    );
  }

  // Si hay evento seleccionado pero no hay inscripciones
  if (inscriptions.length === 0) {
    return (
      <div className="inscriptions-container">
        <h2 className='titulos-admin'>Lista de Inscripciones</h2>
        {eventsData ? (
          <div>
            <FilterSystem
              inscriptions={[]}
              events={eventsData}
              games={games}
              onFilter={applyFilters}
              onFiltersChange={handleFiltersChange}
              initialFilters={activeFilters}
            />

            <div className="inscriptions-header">
              <div className="inscriptions-count">
                Total: <strong>0</strong> emails únicos del evento seleccionado
              </div>
            </div>

            <ExportToExcelButton
              data={[]}
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
                <tr>
                  <td colSpan={headerTable.length} style={{ textAlign: "center", padding: "10px" }}>
                    ⚠️ No hay inscripciones disponibles.
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mobile-notice">
              <small>* En dispositivos móviles solo se muestran apellido, nombre y juegos</small>
            </div>
          </div>
        ) : (
          <div>Cargando eventos...</div>
        )}
      </div>
    );
  }

  // Caso normal: Hay evento seleccionado y hay inscripciones
  return (
    <div className="inscriptions-container">
      {eventsData ? (
        <FilterSystem
          inscriptions={inscriptions}
          events={eventsData}
          games={games}
          onFilter={applyFilters}
          onFiltersChange={handleFiltersChange}
          initialFilters={activeFilters}
        />
      ) : (
        <div>Cargando eventos...</div>
      )}
      <div className="inscriptions-header">
        <h2 className='titulos-admin'>Lista de Inscripciones</h2>
        <div className="inscriptions-count">
          Mostrando: <strong>{filteredInscriptions.length}</strong> inscripciones únicas
          {uniquePlayersCount > 0 && (
            <span> ({uniquePlayersCount} emails únicos)</span>
          )}
          <span> del evento seleccionado</span>
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
              <tr key={`${inscription.id || index}-${inscription.email}-${inscription.juegos}`}>
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
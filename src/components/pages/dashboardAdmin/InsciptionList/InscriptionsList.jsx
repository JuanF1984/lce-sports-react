import React, { useEffect, useState } from 'react';
import supabase from '../../../../utils/supabase';

import { FilterSystem } from './FilterSystem';

import { ExportToExcelButton } from './ExportToExcelButton ';

import { useEvents } from '../../../../hooks/useEvents';

import { useProximoEvento } from '../../../../hooks/useProximoEvento';

import '../../../../styles/InscriptionsList.css';

const PAGE_SIZE = 50;

const toArgentinaDate = (isoStr) => {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
};

const InscriptionsList = () => {
  const [inscriptions, setInscriptions] = useState([]);
  const [filteredInscriptions, setFilteredInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [page, setPage] = useState(0);

  const { proximoEvento, loading: loadingProximoEvento } = useProximoEvento();
  const { eventsData, eventsError, loadingError } = useEvents();

  const [activeFilters, setActiveFilters] = useState({
    eventId: "",
    startDate: "",
    endDate: "",
    gameId: "",
  });

  const headerTable = [
    'Fecha de inscripción',
    'Nombre',
    'Apellido',
    'Edad',
    'Celular',
    'Email',
    'Localidad',
    'Juegos',
  ];

  // Paginación — derivada de filteredInscriptions
  const total = filteredInscriptions.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const pageItems = filteredInscriptions.slice(from, to + 1);

  // Resetear página cuando cambian las inscripciones filtradas
  useEffect(() => {
    setPage(0);
  }, [filteredInscriptions]);

  const formatBatch = (data) => (data || []).map(inscription => {
    const gamesArray = inscription.games_inscriptions || [];
    const juegos = gamesArray.map(gi => gi.game?.game_name).filter(Boolean).join(', ');
    return { ...inscription, juegos: juegos || 'Sin juegos registrados' };
  });

  // Carga inscripciones con paginación por cursor (evita el error 500 de Supabase
  // con offset alto + join anidado). Muestra spinner hasta tener todo.
  const fetchInscriptionsByEvent = async (eventId) => {
    setLoading(true);
    setInscriptions([]);
    setFilteredInscriptions([]);

    try {
      const BATCH = 1000;
      let accumulated = [];
      let cursor = null; // { created_at, id } del último registro visto

      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from("inscriptions")
          .select(`*, games_inscriptions(game:games(id, game_name))`)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(BATCH);

        if (eventId) q = q.eq('id_evento', eventId);

        // Cursor compuesto (created_at, id) para evitar saltear registros con igual timestamp
        if (cursor) {
          q = q.or(
            `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`
          );
        }

        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;

        accumulated = accumulated.concat(formatBatch(data));

        if (data.length < BATCH) break;

        cursor = { created_at: data[data.length - 1].created_at, id: data[data.length - 1].id };
      }

      const unique = filterDuplicatesByPersonAndGame(accumulated);
      setInscriptions(accumulated);
      setFilteredInscriptions(unique);

    } catch (error) {
      console.error("Error inesperado al cargar inscripciones:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterDuplicatesByPersonAndGame = (inscriptions) => {
    const uniqueKeyMap = new Map();
    return inscriptions.filter(inscription => {
      const emailLowerCase = inscription.email?.toLowerCase().trim() || '';
      const fullName = `${inscription.nombre?.toLowerCase().trim() || ''}-${inscription.apellido?.toLowerCase().trim() || ''}`;
      const juegos = inscription.juegos || 'Sin juegos registrados';
      const teamName = inscription.team_name || '';
      const uniqueKey = `${emailLowerCase}|${fullName}|${juegos}|${teamName}`;
      if (!uniqueKeyMap.has(uniqueKey)) {
        uniqueKeyMap.set(uniqueKey, true);
        return true;
      }
      return false;
    });
  };

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const { data: gamesData, error: gamesError } = await supabase
          .from("games")
          .select("*");
        if (gamesError) { console.error("Error al cargar juegos:", gamesError); return; }
        setGames(gamesData);
      } catch (error) {
        console.error("Error inesperado al cargar juegos:", error);
      }
    };
    fetchGames();
  }, []);

  useEffect(() => {
    if (loadingProximoEvento) return;

    const initialEventId = proximoEvento?.id ?? "";
    setActiveFilters(prev => ({ ...prev, eventId: initialEventId }));
    fetchInscriptionsByEvent(initialEventId);
  }, [proximoEvento, loadingProximoEvento]);

  const handleFiltersChange = (newFilters) => {
    setActiveFilters(newFilters);
    if (newFilters.eventId !== activeFilters.eventId) {
      fetchInscriptionsByEvent(newFilters.eventId);
    }
  };

  const applyFilters = (filteredResults) => {
    setFilteredInscriptions(filterDuplicatesByPersonAndGame(filteredResults));
  };

  const getEventDetails = (eventId) => {
    if (eventsError || loadingError) return "Error al cargar los eventos";
    if (!eventsData || !Array.isArray(eventsData)) return "Cargando eventos...";
    const event = eventsData.find((e) => e.id === eventId);
    return event ? `${event.fecha_inicio} - ${event.localidad}` : "Evento no encontrado";
  };

  const Pagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="inscriptions-pagination">
        <button
          className="pagination-btn"
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          ← Anterior
        </button>
        <span className="pagination-info">
          Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong>
          {' '}· mostrando {from + 1}–{Math.min(to + 1, total)} de {total}
        </span>
        <button
          className="pagination-btn"
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
        >
          Siguiente →
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="inscriptions-loading">
        <div className="inscriptions-spinner" />
        <span className="inscriptions-loading-text">Cargando inscripciones…</span>
      </div>
    );
  }

  // Sin inscripciones
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
                {activeFilters.eventId
                  ? 'Total: 0 emails únicos del evento seleccionado'
                  : 'No hay inscripciones registradas.'}
              </div>
            </div>
            <ExportToExcelButton
              data={[]}
              getEventDetails={getEventDetails}
              selectedEvent={eventsData?.find(e => e.id === activeFilters.eventId) ?? null}
            />
            <div className="table-wrapper">
              <table className="inscriptions-table">
                <thead>
                  <tr>{headerTable.map((h, i) => <th key={i}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={headerTable.length} style={{ textAlign: "center", padding: "10px" }}>
                      ⚠️ No hay inscripciones disponibles.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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

  // Caso normal
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
          Mostrando: <strong>{filteredInscriptions.length}</strong> inscripciones
          {activeFilters.eventId
            ? <span> del evento seleccionado</span>
            : <span> de todos los eventos</span>}
        </div>
      </div>

      {/* Export usa TODOS los datos filtrados, no solo la página actual */}
      <ExportToExcelButton
        data={filteredInscriptions}
        getEventDetails={getEventDetails}
        selectedEvent={eventsData?.find(e => e.id === activeFilters.eventId) ?? null}
      />

      <Pagination />

      <div className="table-wrapper">
        <table className="inscriptions-table">
          <thead>
            <tr>{headerTable.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {pageItems.length > 0 ? (
              pageItems.map((inscription, index) => (
                <tr key={`${inscription.id || index}-${inscription.email}-${inscription.juegos}`}>
                  <td>{toArgentinaDate(inscription.created_at)}</td>
                  <td>{inscription.nombre}</td>
                  <td>{inscription.apellido}</td>
                  <td>{inscription.edad}</td>
                  <td>{inscription.celular}</td>
                  <td>{inscription.email}</td>
                  <td>{inscription.localidad}</td>
                  <td>{inscription.juegos}</td>
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

      <Pagination />

      <div className="mobile-notice">
        <small>* En dispositivos móviles solo se muestran apellido, nombre y juegos</small>
      </div>
    </div>
  );
};

export default InscriptionsList;

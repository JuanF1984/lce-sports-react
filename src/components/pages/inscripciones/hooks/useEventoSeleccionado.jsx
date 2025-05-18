// hooks/useEventoSeleccionado.js
import { useState, useEffect } from 'react';
import supabase from '../../../../utils/supabase';

export const useEventoSeleccionado = (eventoId) => {
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [loadingEvento, setLoadingEvento] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchEventoSeleccionado = async () => {
      if (!eventoId) {
        setErrorMessage("No se ha seleccionado ningún evento.");
        setLoadingEvento(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventoId)
          .single();

        if (error) {
          console.error('Error al cargar el evento:', error);
          setErrorMessage("Error al cargar los datos del evento.");
          return;
        }

        if (!data) {
          console.error('No se encontró el evento');
          setErrorMessage("No se encontró el evento seleccionado.");
          return;
        }

        setEventoSeleccionado(data);
      } catch (err) {
        console.error('Error:', err);
        setErrorMessage("Ocurrió un error al cargar los datos del evento.");
      } finally {
        setLoadingEvento(false);
      }
    };

    fetchEventoSeleccionado();
  }, [eventoId]);

  return { eventoSeleccionado, loadingEvento, errorMessage };
};
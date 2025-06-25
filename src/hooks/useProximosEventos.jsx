import { useState, useEffect } from 'react';
import supabase from '../utils/supabase';

// Hook base que obtiene múltiples eventos
export const useProximosEventos = (cantidad = 2) => {
    const [proximosEventos, setProximosEventos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const ayer = new Date();
                ayer.setDate(ayer.getDate() - 1);
                const ayerFormatoYYYYMMDD = ayer.toISOString().split('T')[0];

                const { data, error } = await supabase
                    .from('events')
                    .select('id, fecha_inicio, fecha_fin, localidad, hora_inicio, direccion')
                    .gte('fecha_inicio', ayerFormatoYYYYMMDD)
                    .order('fecha_inicio', { ascending: true })
                    .limit(cantidad);

                if (error) {
                    setError(error);
                } else {
                    // Procesamos los eventos para agregar el día de la semana
                    const eventosConDiaSemana = data.map(evento => {
                        let diaSemana = '';
                        if (evento.fecha_inicio) {
                            const [year, month, day] = evento.fecha_inicio.split('-').map(num => parseInt(num, 10));
                            const fechaInicio = new Date(year, month - 1, day, 12, 0, 0);

                            const diasSemana = [
                                'Domingo', 'Lunes', 'Martes', 'Miércoles',
                                'Jueves', 'Viernes', 'Sábado'
                            ];
                            diaSemana = diasSemana[fechaInicio.getDay()];
                        }
                        return { ...evento, diaSemana };
                    });

                    setProximosEventos(eventosConDiaSemana);
                }
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, [cantidad]);

    return {
        proximosEventos,
        loading,
        error
    };
};
import { useState, useEffect } from 'react';
import supabase from '../utils/supabase';

export const useProximoEvento = () => {
    const [proximoEvento, setProximoEvento] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [diaSemana, setDiaSemana] = useState('');

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // Fecha de hoy en zona horaria argentina (YYYY-MM-DD)
                const hoy = new Date().toLocaleDateString('sv', {
                    timeZone: 'America/Argentina/Buenos_Aires'
                });

                const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

                const setEvento = (evento) => {
                    setProximoEvento(evento);
                    if (evento?.fecha_inicio) {
                        const [year, month, day] = evento.fecha_inicio.split('-').map(Number);
                        setDiaSemana(diasSemana[new Date(year, month - 1, day, 12, 0, 0).getDay()]);
                    }
                };

                // Próximo evento: arranca hoy o después
                const { data: proximos, error } = await supabase
                    .from('events')
                    .select('id, fecha_inicio, fecha_fin, localidad, hora_inicio, direccion')
                    .gte('fecha_inicio', hoy)
                    .order('fecha_inicio', { ascending: true })
                    .limit(1);

                if (error) { setError(error); return; }

                if (proximos && proximos.length > 0) {
                    setEvento(proximos[0]);
                    return;
                }

                // Sin próximo evento: usamos el último evento pasado
                const { data: pasados, error: errorPasado } = await supabase
                    .from('events')
                    .select('id, fecha_inicio, fecha_fin, localidad, hora_inicio, direccion')
                    .lt('fecha_inicio', hoy)
                    .order('fecha_inicio', { ascending: false })
                    .limit(1);

                if (errorPasado) { setError(errorPasado); return; }

                setEvento(pasados?.[0] ?? null);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    const fecha_inicio = proximoEvento?.fecha_inicio || '';
    const fecha_fin = proximoEvento?.fecha_fin || '';
    const localidad = proximoEvento?.localidad || '';
    const hora_inicio = proximoEvento?.hora_inicio || '';
    const direccion = proximoEvento?.direccion || '';

    return { 
        proximoEvento, 
        fecha_inicio, 
        fecha_fin, 
        localidad,
        hora_inicio,
        direccion, 
        diaSemana, 
        loading, 
        error 
    };
};
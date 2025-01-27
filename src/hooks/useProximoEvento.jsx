import { useState, useEffect } from 'react';
import supabase from '../utils/supabase';

export const useProximoEvento = () => {
    const [proximoEvento, setProximoEvento] = useState(null);
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
                    .select('id, fecha_inicio, fecha_fin, localidad')
                    .gte('fecha_inicio', ayerFormatoYYYYMMDD)
                    .order('fecha_inicio', { ascending: true });

                if (error) {
                    setError(error);
                } else {
                    setProximoEvento(data[0] || null);
                }
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

    return { proximoEvento, fecha_inicio, fecha_fin, localidad, loading, error };
};
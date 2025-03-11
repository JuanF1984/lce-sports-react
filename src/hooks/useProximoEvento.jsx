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
                const ayer = new Date();
                ayer.setDate(ayer.getDate() - 1);
                const ayerFormatoYYYYMMDD = ayer.toISOString().split('T')[0];

                const { data, error } = await supabase
                    .from('events')
                    .select('id, fecha_inicio, fecha_fin, localidad, hora_inicio')
                    .gte('fecha_inicio', ayerFormatoYYYYMMDD)
                    .order('fecha_inicio', { ascending: true });

                if (error) {
                    setError(error);
                } else {
                    setProximoEvento(data[0] || null);
                    
                    // Obtener el día de la semana si hay un evento próximo
                    if (data[0]?.fecha_inicio) {
                        // Aseguramos el formato correcto y manejamos la zona horaria adecuadamente
                        const fechaStr = data[0].fecha_inicio;
                        
                        // Formato YYYY-MM-DD con hora fija para evitar problemas de zona horaria
                        const [year, month, day] = fechaStr.split('-').map(num => parseInt(num, 10));
                        const fechaInicio = new Date(year, month - 1, day, 12, 0, 0);
                        
                        const diasSemana = [
                            'Domingo', 'Lunes', 'Martes', 'Miércoles', 
                            'Jueves', 'Viernes', 'Sábado'
                        ];
                        setDiaSemana(diasSemana[fechaInicio.getDay()]);
                        
                    }
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
    const hora_inicio = proximoEvento?.hora_inicio || '';

    return { 
        proximoEvento, 
        fecha_inicio, 
        fecha_fin, 
        localidad,
        hora_inicio, 
        diaSemana, 
        loading, 
        error 
    };
};
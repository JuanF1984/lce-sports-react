// Este archivo contiene funciones para formatear fechas y horas
export const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '';
    
    // Asumiendo que fechaStr es "YYYY-MM-DD"
    const [year, month, day] = fechaStr.split('-').map(num => parseInt(num));
    const fecha = new Date(year, month - 1, day); // Mes es 0-indexed en JavaScript
    
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaSemana = diasSemana[fecha.getDay()];
    
    // Formatear la fecha como string (DD/MM/YYYY)
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const año = fecha.getFullYear();
    
    return `${diaSemana} ${dia}/${mes}/${año}`;
};

export const formatearHora = (hora) => {
    if (!hora) return '';
    return hora.slice(0, 5); // Obtener solo HH:MM
};
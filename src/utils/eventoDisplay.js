// Texto compacto "nombre · localidad" para las barras de estado de una sola
// línea que aparecen en cada paso del wizard de inscripción. Si el evento no
// tiene nombre propio (events.nombre), se mantiene el comportamiento histórico
// de mostrar solo la localidad.
export const tituloEventoCorto = (evento) => {
    if (!evento) return '';
    return evento.nombre ? `${evento.nombre} · ${evento.localidad}` : evento.localidad;
};

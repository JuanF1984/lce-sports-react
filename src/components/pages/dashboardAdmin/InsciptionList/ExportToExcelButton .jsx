import ExcelJS from 'exceljs'

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

// Columnas hoja General (con Juego Principal y Juego Secundario)
const EXPORT_COLUMNS_GENERAL = [
    { header: 'Fecha de inscripción', key: 'fecha_inscripcion' },
    { header: 'Nombre',               key: 'nombre' },
    { header: 'Apellido',             key: 'apellido' },
    { header: 'Edad',                 key: 'edad' },
    { header: 'Celular',              key: 'celular' },
    { header: 'Email',                key: 'email' },
    { header: 'Localidad',            key: 'localidad' },
    { header: 'Juegos',               key: 'juegos' },
    { header: 'Juego Principal',      key: 'juego_principal' },
    { header: 'Juego Secundario',     key: 'juego_secundario' },
    { header: 'Evento',               key: 'evento' },
    { header: 'Equipo',               key: 'equipo' },
    { header: 'riot_id',              key: 'riot_id' },
    { header: 'steam_username',       key: 'steam_username' },
];

// Columnas hojas por juego (con Observación de prioridad)
const EXPORT_COLUMNS_GAME = [
    { header: 'Fecha de inscripción', key: 'fecha_inscripcion' },
    { header: 'Nombre',               key: 'nombre' },
    { header: 'Apellido',             key: 'apellido' },
    { header: 'Edad',                 key: 'edad' },
    { header: 'Celular',              key: 'celular' },
    { header: 'Email',                key: 'email' },
    { header: 'Localidad',            key: 'localidad' },
    { header: 'Juegos',               key: 'juegos' },
    { header: 'Observación',          key: 'observacion' },
    { header: 'Evento',               key: 'evento' },
    { header: 'Equipo',               key: 'equipo' },
    { header: 'riot_id',              key: 'riot_id' },
    { header: 'steam_username',       key: 'steam_username' },
];

// Devuelve el nombre del juego con priority dado (null/undefined → '')
const getJuegoPorPrioridad = (inscription, priority) => {
    const gi = (inscription.games_inscriptions || []).find(g => g.priority === priority);
    return gi?.game?.game_name || '';
};

// Devuelve 'Principal', 'Secundario' o '' según priority del juego en esa inscripción
const getObservacion = (inscription, gameName) => {
    const gi = (inscription.games_inscriptions || []).find(g => g.game?.game_name === gameName);
    if (!gi || gi.priority == null) return '';
    if (gi.priority === 1) return 'Principal';
    if (gi.priority === 2) return 'Secundario';
    return '';
};

const buildRowGeneral = (inscription, getEventDetails) => ({
    fecha_inscripcion: toArgentinaDate(inscription.created_at),
    nombre:            inscription.nombre,
    apellido:          inscription.apellido,
    edad:              inscription.edad,
    celular:           inscription.celular,
    email:             inscription.email,
    localidad:         inscription.localidad,
    juegos:            inscription.juegos,
    juego_principal:   getJuegoPorPrioridad(inscription, 1),
    juego_secundario:  getJuegoPorPrioridad(inscription, 2),
    evento:            getEventDetails(inscription.id_evento),
    equipo:            inscription.team_name || '',
    riot_id:           inscription.riot_id || '',
    steam_username:    inscription.steam_username || '',
});

const buildRowGame = (inscription, getEventDetails, gameName) => ({
    fecha_inscripcion: toArgentinaDate(inscription.created_at),
    nombre:            inscription.nombre,
    apellido:          inscription.apellido,
    edad:              inscription.edad,
    celular:           inscription.celular,
    email:             inscription.email,
    localidad:         inscription.localidad,
    juegos:            inscription.juegos,
    observacion:       getObservacion(inscription, gameName),
    evento:            getEventDetails(inscription.id_evento),
    equipo:            inscription.team_name || '',
    riot_id:           inscription.riot_id || '',
    steam_username:    inscription.steam_username || '',
});

const autofitColumns = (ws) => {
    ws.columns.forEach(col => {
        let maxLen = col.header ? col.header.length : 10;
        col.eachCell({ includeEmpty: false }, cell => {
            const len = cell.value ? String(cell.value).length : 0;
            if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(maxLen + 2, 60);
    });
};

const GRAY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

const addSheet = (workbook, sheetName, rows, getEventDetails, columns, buildRow) => {
    const safeName = sheetName.slice(0, 31);
    const ws = workbook.addWorksheet(safeName);
    ws.columns = columns;
    ws.getRow(1).font = { bold: true };
    rows.forEach((insc, i) => {
        const row = ws.addRow(buildRow(insc, getEventDetails));
        if (i % 2 === 1) row.eachCell(cell => { cell.fill = GRAY; });
    });
    autofitColumns(ws);
};

const addEvolucionSheet = (workbook, data) => {
    const ws = workbook.addWorksheet('Evolución');
    ws.columns = [
        { header: 'Fecha',           key: 'fecha',          width: 14 },
        { header: 'Inscripciones',   key: 'inscripciones',  width: 16 },
    ];
    ws.getRow(1).font = { bold: true };

    // Agrupar por fecha argentina (DD/MM/YYYY, sin hora)
    const counts = new Map();
    data.forEach(insc => {
        if (!insc.created_at) return;
        const date = new Date(insc.created_at);
        const parts = new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            day: '2-digit', month: '2-digit', year: 'numeric',
        }).formatToParts(date);
        const get = (type) => parts.find(p => p.type === type)?.value ?? '';
        const key = `${get('year')}-${get('month')}-${get('day')}`; // para ordenar
        const label = `${get('day')}/${get('month')}/${get('year')}`;
        counts.set(key, { label, count: (counts.get(key)?.count ?? 0) + 1 });
    });

    [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([, { label, count }], i) => {
            const row = ws.addRow({ fecha: label, inscripciones: count });
            if (i % 2 === 1) row.eachCell(cell => { cell.fill = GRAY; });
        });
};

const buildFileName = (selectedEvent) => {
    if (selectedEvent?.localidad && selectedEvent?.fecha_inicio) {
        const localidad = selectedEvent.localidad
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
        const fecha = selectedEvent.fecha_inicio.replace(/-/g, '_'); // "2026-03-07" → "2026_03_07"
        return `${localidad}_${fecha}.xlsx`;
    }
    // Fallback si no hay evento seleccionado
    const ts = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
    return `inscripciones_${ts}.xlsx`;
};

export const ExportToExcelButton = ({ data, getEventDetails, selectedEvent }) => {
    const exportToExcel = () => {
        const workbook = new ExcelJS.Workbook();

        // ── Hoja General ──────────────────────────────────────────
        addSheet(workbook, 'General', data, getEventDetails, EXPORT_COLUMNS_GENERAL, buildRowGeneral);

        // ── Una hoja por juego ────────────────────────────────────
        const gameNames = [...new Set(
            data.flatMap(insc =>
                (insc.games_inscriptions || [])
                    .map(gi => gi.game?.game_name)
                    .filter(Boolean)
            )
        )].sort();

        gameNames.forEach(gameName => {
            const inscForGame = data.filter(insc =>
                (insc.games_inscriptions || []).some(gi => gi.game?.game_name === gameName)
            );
            addSheet(workbook, gameName, inscForGame, getEventDetails, EXPORT_COLUMNS_GAME,
                (insc, ged) => buildRowGame(insc, ged, gameName)
            );
        });

        // ── Hoja Evolución ────────────────────────────────────────
        addEvolucionSheet(workbook, data);

        // ── Descargar ─────────────────────────────────────────────
        workbook.xlsx.writeBuffer().then((buffer) => {
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = buildFileName(selectedEvent);
            link.click();
        });
    };

    return (
        <button onClick={exportToExcel} className="export-button">Exportar a Excel</button>
    );
};

import ExcelJS from 'exceljs'


export const ExportToExcelButton = ({ data, getEventDetails, headerTable }) => {
    const exportToExcel = () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inscripciones');

        const currentDateTime = new Date()
            .toISOString() // Formato ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)
            .replace(/T/, '_') // Reemplaza la 'T' por un guion bajo
            .replace(/:/g, '-') // Reemplaza los dos puntos por guiones
            .replace(/\..+/, ''); // Elimina la parte de milisegundos y 'Z'

        const fileName = `inscripciones_${currentDateTime}.xlsx`;

        // Definir las columnas del archivo Excel
        worksheet.columns = headerTable.map(header => ({
            header,
            key: header.toLowerCase(), // nombre de la clave es en minúsculas
        }));

        // Agregar filas con los datos de las inscripciones
        data.forEach((inscription) => {
            worksheet.addRow({
                nombre: inscription.nombre,
                apellido: inscription.apellido,
                edad: inscription.edad,
                celular: inscription.celular,
                juegos: inscription.juegos,
                localidad: inscription.localidad,
                evento: getEventDetails(inscription.id_evento),
                equipo: inscription.team_name,
            });
        });

        // Descargar el archivo
        workbook.xlsx.writeBuffer().then((buffer) => {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;  // Nombre del archivo
            link.click();
        });
    };

    return (
        <button onClick={exportToExcel} className="export-button">Exportar a Excel</button>
    );
}

Para lograr que la aplicación envíe los archivos PDF y CSV directamente a través de WhatsApp listos para imprimir y con el membrete de CONSTRURAMSA, debemos usar la API nativa del navegador llamada Web Share API.WhatsApp Web o móvil no permite inyectar diseño visual directamente en un mensaje de texto. Por lo tanto, la solución técnica profesional consiste en generar los archivos binarios en la memoria del dispositivo y adjuntarlos como archivos reales al chat, permitiendo que se abran e impriman de inmediato.A continuación, tienes la estructura lógica en JavaScript para implementar esta función, seguida del prompt final actualizado para tu agente de VS Code.

Lógica en JavaScript para Compartir Archivos en WhatsAppEsta función toma los datos del reporte diario o semanal, genera los documentos con el membrete y activa el menú nativo para enviarlos por WhatsApp o Correo

async function compartirReporteWhatsApp(nombreReporte, contenidoCSV, elementoHTMLParaPDF) {
    try {
        const archivosParaCompartir = [];

        // 1. Preparar el archivo CSV
        const blobCSV = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
        const archivoCSV = new File([blobCSV], `${nombreReporte}.csv`, { type: 'text/csv' });
        archivosParaCompartir.push(archivoCSV);

        // 2. Preparar el archivo PDF (Usando html2pdf.js en memoria)
        if (elementoHTMLParaPDF) {
            const opciones = {
                margin: 10,
                filename: `${nombreReporte}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
            };
            
            // Generamos el PDF como Blob para adjuntarlo
            const blobPDF = await html2pdf().set(opciones).from(elementoHTMLParaPDF).output('blob');
            const archivoPDF = new File([blobPDF], `${nombreReporte}.pdf`, { type: 'application/pdf' });
            archivosParaCompartir.push(archivoPDF);
        }

        // 3. Validar si el dispositivo soporta compartir archivos nativos
        if (navigator.canShare && navigator.canShare({ files: archivosParaCompartir })) {
            await navigator.share({
                files: archivosParaCompartir,
                title: `Reporte de Obra - ${nombreReporte}`,
                text: `Adjunto se envían los reportes de control de obra de CONSTRURAMSA.`
            });
        } else {
            // Fallback en caso de navegadores de escritorio antiguos que no soportan Web Share de archivos
            alert("Tu navegador no soporta compartir archivos directamente. Se procederá a descargarlos localmente.");
            descargarLocal(archivoCSV, archivoPDF);
        }
    } catch (error) {
        console.error("Error al compartir en WhatsApp:", error);
    }
}



Para que los reportes se exporten a PDF de forma impecable, con el membrete perfectamente alineado y listos para imprimir en tamaño Carta/A4, no podemos confiar en el diseño ordinario de la pantalla. Necesitamos una plantilla HTML/CSS oculta de alta resolución diseñada exclusivamente para el motor de impresión (html2pdf.js).A continuación, tienes la estructura visual exacta de la plantilla del membrete y el código optimizado para que la IA de tu VS Code lo ensamble sin errores.

 Estructura Visual del Membrete (Maqueta HTML)Este bloque de código representa el encabezado profesional que se inyectará automáticamente al inicio de cada reporte (Diario, Semanal, Asistencia):

<!-- Plantilla de Impresión Impecable (Oculta en pantalla, visible en PDF) -->
<div id="plantilla-reporte-impresion" style="display: none; font-family: 'Arial', sans-serif; color: #111827; padding: 30px; background: #ffffff;">
    
    <!-- ENCABEZADO / MEMBRETE -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border-bottom: 3px solid #004B93;">
        <tr>
            <!-- Lado Izquierdo: Logotipo Corporativo -->
            <td style="width: 25%; padding-bottom: 15px; vertical-align: middle;">
                <img id="pdf-logo-membrete" src="" alt="CONSTRURAMSA LOGO" style="max-height: 85px; width: auto; object-fit: contain;" />
            </td>
            
            <!-- Centro: Nombre de la Empresa y Eslogan -->
            <td style="width: 50%; text-align: center; padding-bottom: 15px; vertical-align: middle;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; color: #004B93; text-transform: uppercase;">CONSTRURAMSA</h1>
                <p style="margin: 4px 0 0 0; font-size: 10px; font-weight: 600; color: #6F2DBD; text-transform: uppercase; letter-spacing: 0.5px;">Soluciones en Ingeniería y Arquitectura</p>
            </td>
            
            <!-- Lado Derecho: Metadatos del Reporte -->
            <td style="width: 25%; text-align: right; padding-bottom: 15px; vertical-align: middle; font-size: 11px; line-height: 1.4; color: #4B5563;">
                <strong>TIPO:</strong> <span id="pdf-tipo-reporte" style="color: #00A4E4; font-weight: bold;">DIARIO DE GASTOS</span><br>
                <strong>FECHA:</strong> <span id="pdf-fecha-emision">24/08/2026</span><br>
                <strong>PROYECTO:</strong> Control de Obra Activa
            </td>
        </tr>
    </table>

    <!-- CUERPO DEL REPORTE (Aquí se inyectan las tablas dinámicamente) -->
    <div id="pdf-contenido-dinamico"></div>

    <!-- PIE DE PÁGINA / FIRMAS -->
    <div style="margin-top: 50px; page-break-inside: avoid;">
        <table style="width: 100%; margin-top: 40px;">
            <tr>
                <td style="width: 45%; text-align: center;">
                    <div style="border-top: 1px solid #9CA3AF; width: 80%; margin: 0 auto; padding-top: 5px; font-size: 12px; font-weight: bold; color: #374151;">
                        Ing. Residente / Supervisor
                    </div>
                </td>
                <td style="width: 10%;"></td>
                <td style="width: 45%; text-align: center;">
                    <div style="border-top: 1px solid #9CA3AF; width: 80%; margin: 0 auto; padding-top: 5px; font-size: 12px; font-weight: bold; color: #374151;">
                        Control de Caja / Administración
                    </div>
                </td>
            </tr>
        </table>
        <div style="text-align: center; margin-top: 30px; font-size: 9px; color: #9CA3AF;">
            Documento generado digitalmente desde la App Oficial de CONSTRURAMSA.
        </div>
    </div>
</div>


Estilos Críticos para las Tablas del PDF (Limpieza Total)Dado que la aplicación principal utiliza un tema oscuro y translúcido (Glasmorphism), al momento de imprimir debemos revertir los estilos a blanco y negro de alta calidad para no agotar la tinta de la impresora y asegurar una legibilidad perfecta.Añade estas reglas CSS específicas para la estructura del reporte impreso:

/* Estilos específicos para la renderización del PDF */
#plantilla-reporte-impresion table.tabla-pdf {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

#plantilla-reporte-impresion table.tabla-pdf th {
  background-color: #f3f4f6; /* Gris muy claro profesional */
  color: #111827;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  text-align: left;
}

#plantilla-reporte-impresion table.tabla-pdf td {
  font-size: 11px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  color: #374151;
}

/* Filas alternas para facilitar la lectura de costos */
#plantilla-reporte-impresion table.tabla-pdf tr:nth-child(even) {
  background-color: #f9fafb;
}

/* Destacar los totales monetarios */
.total-destacado {
  font-weight: bold;
  color: #004B93;
  text-align: right;
}


Lógica JavaScript de Ensamblado AutomáticoCuando el usuario pulse el botón de compartir, esta función clonará el logotipo guardado en Base64, inyectará las tablas correspondientes del módulo y creará el PDF limpio en la memoria:

function prepararContenedorImpresion(tituloReporte, tablaHTMLData) {
    // 1. Recuperar el logotipo en Base64 desde el LocalStorage
    const db = JSON.parse(localStorage.getItem('construramsa_db')) || {};
    const logoBase64 = db.configuracion?.logo_base64 || ""; 
    
    // Fallback: Si no hay logo cargado, podemos usar un marcador o dejar el espacio
    const logoImg = document.getElementById('pdf-logo-membrete');
    if (logoBase64) {
        logoImg.src = logoBase64;
        logoImg.style.display = 'block';
    } else {
        logoImg.style.display = 'none'; // Se oculta elegantemente si está vacío
    }

    // 2. Rellenar metadatos dinámicos del membrete
    document.getElementById('pdf-tipo-reporte').innerText = tituloReporte.toUpperCase();
    document.getElementById('pdf-fecha-emision').innerText = new Date().toLocaleDateString('es-ES');
    
    // 3. Inyectar los datos de las tablas
    document.getElementById('pdf-contenido-dinamico').innerHTML = tablaHTMLData;
    
    // Retornamos el elemento contenedor listo para ser procesado por html2pdf.js
    return document.getElementById('plantilla-reporte-impresion');
}


Instrucción Adicional para enviar a tu Agente de VS Code:Cuando le pidas al agente que ensamble el código definitivo de la PWA, añade esta directiva específica sobre la plantilla que acabamos de revisar:

"Utiliza la estructura del membrete de impresión en una sección oculta del HTML. Asegúrate de que al generar el PDF mediante html2pdf.js, el fondo cambie completamente a color blanco absoluto (#ffffff) con tipografías oscuras, de modo que el diseño 'Glasmorphism' de la pantalla no afecte el documento final y este sea apto para impresoras físicas de oficina, manteniendo de manera rígida el logotipo a la izquierda, el membrete centralizado y la sección de firmas al fondo."


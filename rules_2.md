Prompt Final Actualizado para VS CodeCopia y pega este prompt definitivo en tu agente de IA (GitHub Copilot, Cline, etc.). Ya incluye la base de datos, el diseño Glasmorphism, el membrete automático y la función de envío de archivos directos:

Genera el código completo para una Aplicación Web Progresiva (PWA) de control de obra, optimizada para ejecutarse 100% offline mediante LocalStorage. El sistema debe estructurarse utilizando componentes modulares con estilos avanzados de GLASMORPHISM.

---

### 1. IDENTIDAD CORPORATIVA Y DISEÑO VISUAL
- **Empresa:** CONSTRURAMSA
- **Eslogan:** SOLUCIONES EN INGENIERÍA Y ARQUITECTURA
- **Paleta Estética:** Fondos oscuros premium (#090a0f), tarjetas con efecto cristal translúcido (background: rgba(20,24,35,0.45); backdrop-filter: blur(16px);) y bordes finos con degradados en azul cian brillante (#00A4E4), azul eléctrico (#004B93) y púrpura (#6F2DBD).
- **Logotipo Dinámico:** Añade una sección de configuración para cargar el logo desde el almacenamiento local. Debe guardarse en LocalStorage en Base64. Este logotipo se renderizará automáticamente en la cabecera de la app y como membrete obligatorio en la parte superior de cada reporte generado junto al nombre y eslogan.

---

### 2. MÓDULOS DE LA APLICACIÓN
Cada módulo debe constar de su propio formulario de ingreso de datos y tablas de visualización estilizadas:
1. **Caja Chica e Insumos:** Registro de ingresos, gastos diarios (materiales menores, imprevistos) y balance automatizado.
2. **Maquinaria y Flota:** Control de horas de odómetro/horómetro de retroexcavadoras y camiones de volteo, registro de galones de combustible con costo, y bitácora de suministros de repuestos o mantenimientos.
3. **Personal y Asistencia:** Catálogo de empleados con tarifas por hora normal y extra. Registro diario de asistencia y cálculo automatizado de la nómina semanal (Lunes a Domingo).
4. **Proveedores y Cotizaciones:** Directorio de contactos y cuadro comparativo para aprobar o rechazar cotizaciones de materiales.

---

### 3. GENERACIÓN DE REPORTES Y COMPARTICIÓN POR WHATSAPP
Implementa un motor de reportes profesionales listos para imprimir en formato Carta. Deben incluir el membrete de CONSTRURAMSA, fecha de emisión, el logotipo cargado y firmas de responsabilidad.

Desarrolla las opciones para:
- Reporte Diario de Gastos y Combustible.
- Informe Semanal Consolidado (Lunes a Domingo).
- Reporte de Asistencia y Horas Extra con cálculos de sueldo.

**Requisito de Envío Crítico:**
Añade un botón "Enviar Reporte por WhatsApp / Correo". Al presionarlo, la aplicación NO debe enviar texto simple; debe generar en segundo plano el archivo estructurado en .CSV y el documento visual en .PDF (Integrando la librería html2pdf.js desde CDN). Utiliza la API 'navigator.share' para adjuntar ambos archivos binarios reales directamente al menú de compartir, permitiendo al usuario enviarlos por WhatsApp listos para abrir, revisar e imprimir desde cualquier dispositivo móvil u ordenador.

---

### 4. RESPALDO DE DATOS
Incluye funciones para "Exportar Base de Datos JSON" e "Importar Base de Datos JSON" para salvaguardar o clonar toda la información de la obra entre dispositivos. Entrega todo el código HTML, CSS y JavaScript integrado y comentado de manera exhaustiva.

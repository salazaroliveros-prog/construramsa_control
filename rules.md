Actúa como un Ingeniero de Software Senior y Experto en UI/UX Frontend. Genera el código completo de una Aplicación Web Progresiva (PWA) contenida en un único archivo HTML autocontenido (o estructura modular index.html, styles.css, app.js si lo consideras mejor para rendimiento, pero priorizando que funcione localmente sin servidores externos como Node.js o bases de datos relacionales).

La aplicación debe funcionar 100% offline utilizando LocalStorage para el almacenamiento de datos, permitiendo exportar e importar la base de datos en formato JSON para poder compartirla fácilmente a través de WhatsApp o correo electrónico.

---

### 1. IDENTIDAD CORPORATIVA Y ESTILO (UI/UX)
- **Nombre de la empresa:** CONSTRURAMSA
- **Eslogan:** SOLUCIONES EN INGENIERÍA Y ARQUITECTURA
- **Paleta de Colores (Basada en logotipo):** 
  - Fondo oscuro/principal: Negro (#000000) o Gris muy oscuro (#0D0D11).
  - Acentos y degradados: Azul cian brillante (#00A4E4), Azul eléctrico (#004B93), y toques Morados/Púrpuras (#6F2DBD) para la grúa y detalles superiores.
- **Estilo Visual:** GLASMORPHISM moderno y actual. Usa fondos semi-transparentes (`backdrop-filter: blur(12px) *background: rgba(255,255,255,0.03)*`), bordes finos con degradados sutiles, sombras suaves difuminadas y tipografías limpias (ej. Inter o Roboto).
- **Diseño Adaptivo:** Enfoque Mobile-First (diseño optimizado para Android/iOS) pero con escalabilidad perfecta en pantallas de escritorio (Grid/Flexbox).
- **Logotipo:** Incluye un input de configuración inicial que permita al usuario cargar el logotipo de la empresa desde el almacenamiento local de su dispositivo (guardado en LocalStorage en Base64). Este logo debe aparecer de forma fija en el header de la app y automáticamente en el membrete de todos los reportes generados.

---

### 2. ARQUITECTURA DE MÓDULOS (Cada uno con sus formularios y tablas de visualización)

#### Módulo 1: Caja Chica e Insumos
- Registro de ingresos (aperturas de caja, asignación de fondos).
- Registro de egresos rápidos con selector de categoría (comida, ferretería, imprevistos).
- Validación de saldo disponible en tiempo real antes de permitir un gasto.

#### Módulo 2: Maquinaria y Flota (Retroexcavadoras y Camiones de Volteo)
- Control de Horas/Odómetro (Horas iniciales, horas finales, cálculo automático de horas trabajadas).
- Registro de Combustible (Galones/Litros, costo total, kilometraje/horómetro actual).
- Suministro de Repuestos y Mantenimiento (Tipo de servicio, piezas cambiadas, próximo mantenimiento preventivo programado).

#### Módulo 3: Personal, Asistencia y Nómina
- Catálogo de trabajadores (Nombre, puesto, pago por hora normal, pago por hora extra).
- Registro de asistencia diaria (Asistió / Faltó / Justificado).
- Registro de Horas Extra (Cantidad de horas realizadas en el día).

#### Módulo 4: Adquisiciones, Proveedores y Cotizaciones
- Directorio de proveedores (Nombre, contacto, teléfono, especialidad).
- Registro y comparativa de cotizaciones (Material, proveedor, precio unitario, tiempo de entrega, estado: "Aprobada/Rechazada").
- Orden de compra de materiales aprobados (Enlazado al inventario o gasto de la obra).

---

### 3. MEJORAS E IMPLEMENTACIONES ADICIONALES (Propuestas del sistema)
- **Módulo de Dashboard/Métricas:** Gráficos visuales rápidos (puedes usar Chart.js vía CDN con fallback local o puros elementos CSS/SVG nativos) que muestren el gasto acumulado vs. presupuesto de caja chica, y horas de uso de maquinaria.
- **Sincronización manual / Backup:** Botón prominente en el menú para "Exportar Respaldo completo (JSON)" y "Importar Respaldo (JSON)". Esto permite enviar toda la app por WhatsApp y que otro ingeniero la cargue en su teléfono y vea los mismos datos.
- **Compartir por API Web Share:** Un botón nativo para compartir reportes de texto resumidos directamente a WhatsApp instalados en el móvil.

---

### 4. LÓGICA DE REPORTES Y EXPORTACIÓN
Todos los reportes deben incluir obligatoriamente el membrete profesional de **CONSTRURAMSA**, el eslogan, la fecha/hora de generación y el logotipo cargado previamente.

Deben desarrollarse las siguientes funciones de generación de reportes:
1. **Reporte Diario de Gastos:** Consolidado de todo el dinero salido de caja chica, combustible y compras del día seleccionado.
2. **Informe Semanal Consolidado:** Agrupación de datos de Lunes a Domingo (Gastos, horas de máquina, materiales comprados).
3. **Reporte de Asistencia y Horas Extra:** Control diario y semanal detallado por cada trabajador con cálculo automático de su sueldo devengado en el periodo.

**Formatos de salida:**
- **CSV:** Generación limpia mediante código JS nativo (`Blob` con codificación UTF-8 para evitar problemas de acentos).
- **PDF:** Integración de la librería `html2pdf.js` o `jsPDF` vía CDN. Configura la impresión para que aplique un diseño limpio y profesional, respetando el membrete y el logotipo en el encabezado.

---

### 5. REQUISITOS TÉCNICOS DE COMPILACIÓN
- Escribe el código modularizado con comentarios claros para cada módulo.
- Asegúrate de incluir el archivo `manifest.json` y el Service Worker básico embebido o estructurado para que el navegador lo detecte como PWA instalable en Android/iOS (Agregar a pantalla de inicio).
- Todo el manejo de fechas debe ser amigable e intuitivo (selectores de fecha nativos de HTML5).
- Entrega las estructuras HTML, los estilos CSS estructurados con variables, y toda la lógica de JavaScript.

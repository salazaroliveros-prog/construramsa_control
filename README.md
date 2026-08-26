# CONSTRURAMSA - Control de Obra

Aplicación Web Progresiva (PWA) para el control de gastos y gestión de obra de CONSTRURAMSA.

## Características

- **100% Offline**: Funciona completamente sin conexión a internet usando LocalStorage
- **Diseño Glasmorphism Premium**: Interfaz moderna con efectos de cristal y paleta corporativa
- **Sistema Monetario en Quetzales (Q)**: Todos los montos expresados en moneda nacional de Guatemala
- **Multi-Proyecto**: Gestión de múltiples proyectos con datos completamente aislados por proyecto
- **Módulos Completos**:
  - 📊 Panel de Resumen Ejecutivo con KPIs, alertas de fondos bajos, stock mínimo de insumos y pendientes del día
  - 💰 Caja Chica e Insumos con validación de saldo por proyecto
  - 🚜 Maquinaria y Flota con cálculos automáticos de rendimiento (N/A cuando sin combustible)
  - 👷 Personal, Asistencia y Nómina con cálculo de horas extra
  - 📋 Adquisiciones y Proveedores con cotizaciones
  - 🚛 Control de Viajes de Camiones: rutas al botadero, distancia, tipo de material, camiones propios (consumo de combustible estimado por km) y alquilados (tarifa por día o por viaje)
  - 🔧 Mantenimiento y Control de Insumos: catálogo de maquinaria, formatos de inspección preventivo/correctivo, compras de repuestos/aceites/hidráulicos/combustible y alertas de stock mínimo
- **Reportes Profesionales**: PDF, CSV y XLSX con membrete corporativo, desglose de ingresos, egresos, saldo neto y consolidado (caja + viajes + mantenimiento + insumos) diario y semanal
- **Compartir por WhatsApp**: Integración con Web Share API
- **Respaldo de Datos**: Exportación e importación con fusión inteligente
- **Accesibilidad WCAG 2.1 AA**: Contraste de colores corregido, aria-live, aria-label en todos los controles
- **Paginación**: Tablas de historial paginadas a 20 registros por página
- **PWA Completa**: Service Worker v2.6.0 con activación inmediata y cache robusto

## Instalación

### Requisitos
- Navegador web moderno (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- Para instalación como app: Android 5+ o iOS 11.3+

### Instalación como PWA
1. Abra `index.html` en su navegador (o sirva el directorio con un servidor local)
2. **Android**: Tap en "Agregar a pantalla de inicio" en el menú del navegador
3. **iOS**: Tap en el botón de compartir → "Agregar a pantalla de inicio"
4. **Escritorio**: Icono de instalación en la barra de direcciones de Chrome/Edge

## Uso

### Flujo recomendado
1. **Crear Proyecto**: En el encabezado, presiona ➕ para crear un proyecto con su presupuesto
2. **Seleccionar Proyecto**: Elige el proyecto activo en el selector del encabezado
3. **Caja Chica**: Registra ingresos (aperturas) y egresos diarios — el saldo se valida automáticamente
4. **Maquinaria**: Registra uso de equipo; los gastos se descuentan automáticamente de caja chica
5. **Personal**: Realiza el pase de lista diario y registra horas extra
6. **Adquisiciones**: Registra cotizaciones; al aprobarlas se descuentan de caja chica
7. **Reportes**: Genera PDF y CSV con totales diferenciados por ingresos, egresos y saldo neto

### Atajos de teclado
| Atajo | Acción |
|-------|--------|
| `Alt + 1` | Módulo Caja Chica |
| `Alt + 2` | Módulo Maquinaria |
| `Alt + 3` | Módulo Personal |
| `Alt + 4` | Módulo Adquisiciones |
| `Alt + 5` | Módulo Reportes |
| `Alt + 6` | Módulo Configuración |
| `Alt + S` | Guardar formulario activo |
| `Escape` | Cerrar modales y overlays |

## Estructura de Archivos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Aplicación principal (HTML + CSS + JavaScript) |
| `sw.js` | Service Worker v2.6.0 para funcionalidad offline |
| `manifest.json` | Configuración PWA con shortcuts de módulos |
| `icon.png` | Icono corporativo 1024×1024 (instalación/PWA) |
| `icon-512.png` | Icono PWA 512×512 |
| `icon-192.png` | Icono PWA 192×192 (instalación pantalla de inicio) |
| `icon.svg` | Icono vectorial corporativo |
| `wilson.png` | Firma Arq. Wilson Dario Salazar Oliveros |
| `juan.png` | Firma Ing. Juan LLuis Ramirez Jimenez |
| `construramsa_db.json` | Base de datos inicial de ejemplo |
| `README.md` | Esta documentación |

## Estructura de Base de Datos

```json
{
  "configuracion": {
    "nombre_empresa": "CONSTRURAMSA",
    "eslogan": "SOLUCIONES EN INGENIERÍA Y ARQUITECTURA",
    "logo_base64": "",
    "presupuesto_inicial_caja": 0,
    "proyecto_actual": null
  },
  "proyectos": [],
  "proyectos_data": {
    "<proyectoId>": {
      "caja_chica": [],
      "maquinaria_flota": { "vehiculos": [], "registros": [] },
      "personal": { "trabajadores": [], "asistencia": [] },
      "adquisiciones": { "proveedores": [], "cotizaciones_compras": [] }
    }
  },
  "caja_chica": [],
  "maquinaria_flota": { "vehiculos": [], "registros": [] },
  "personal": { "trabajadores": [], "asistencia": [] },
  "adquisiciones": { "proveedores": [], "cotizaciones_compras": [] }
}
```

> **Nota**: Cuando hay un proyecto activo, todos los datos se guardan en `proyectos_data[proyectoId]`.
> Los campos raíz (`caja_chica`, `personal`, etc.) se usan solo cuando no hay proyecto seleccionado.

## Flujo de Trabajo de Campo a Oficina

**Desde el campo:**
1. El trabajador registra datos del día (caja, maquinaria, asistencia, etc.)
2. Exporta la base de datos: `⚙️ Configuración → 📤 Exportar JSON`
3. Comparte el archivo por WhatsApp o correo

**En la oficina:**
1. Recibe el archivo JSON
2. Importa: `⚙️ Configuración → 📥 Importar JSON`
3. El sistema fusiona automáticamente sin perder datos anteriores

### Estrategia de fusión
- **Caja Chica, Maquinaria, Proveedores, Cotizaciones**: fusión por ID único
- **Asistencia**: fusión por `fecha + trabajador_id` (evita duplicados del mismo día)
- **Proyectos**: fusión por ID de proyecto, incluyendo todos sus datos

## Sistema Monetario

Todos los montos están en **Quetzales (Q)**, moneda nacional de Guatemala:
- Formato: `Q0.00` (ejemplo: `Q150.50`)
- Reportes incluyen: Total Ingresos, Total Egresos y Saldo Neto por separado

## Accesibilidad (WCAG 2.1 AA)

| Elemento | Color | Fondo | Ratio | Estado |
|----------|-------|-------|-------|--------|
| Texto principal | `#f3f4f6` | `#090a0f` | ~18:1 | ✅ AAA |
| Texto secundario | `#9ca3af` | `#090a0f` | ~7.5:1 | ✅ AA |
| Acento cian | `#00A4E4` | `#090a0f` | ~6.8:1 | ✅ AA |
| Acento púrpura | `#a855f7` | `#090a0f` | ~4.6:1 | ✅ AA |
| Footer PDF | `#6B7280` | `#ffffff` | ~4.6:1 | ✅ AA |

## Historial de Cambios

### v2.7.2 (2026-08-26) — Membrete oficial en exportaciones PDF
- **Plantilla PDF**: rediseño completo fiel al membrete oficial de CONSTRURAMSA — logo centrado grande, nombre con letra-spacing amplio, slogan en azul bold, franja doble azul-cian divisoria
- **Membrete**: estructura de 3 zonas — metadatos del reporte (izq.), logo + nombre + contacto (centro), recuadro de sello/timbre (der.)
- **Firmas**: firma de Wilson y Juan alineadas al fondo de su celda (mismo nivel que la línea), espacio en blanco central para V°B° manuscrito
- **CSS**: padding reducido de 20mm a 8mm/14mm para acomodar el membrete compacto; `h2`, `h3`, `p` con estilos propios dentro de `#plantilla-reporte-impresion` para consistencia tipográfica
- **prepararContenedorImpresion()**: mejora — limpia el contenido previo antes de insertar, recarga imágenes de firma de forma forzada, y lee tel/email desde la configuración guardada con fallback a los datos corporativos

### v2.7.1 (2026-08-26) — Correcciones de UI y refinamiento
- **CSS - llave sobrante**: eliminada llave de cierre extra al final del bloque `@media (max-width: 360px)` que desbalanceaba el CSS
- **CSS - .btn-row**: nueva clase reutilizable para filas de botones en formularios — `flex-wrap: wrap` garantiza que en pantallas ≤360px los botones no rebasen horizontalmente
- **CSS - will-change**: `will-change: transform` en `.btn-primario:active`, `.btn-secundario:active` y `.nav-tab:active` para GPU layer en animaciones de escala
- **CSS - .form-grid-1**: nueva clase para grids de 1 columna (reemplaza el último grid inline del HTML)
- **CSS - modal consistente**: `max-height` en `.modal-content` unificado a `90dvh` en todos los breakpoints (era `85dvh` en 768px, inconsistente)
- **HTML - btn-row**: los 5 divs de botones submit+cancelar en formularios ahora usan la clase `.btn-row`
- **HTML - flex-wrap**: `flex-wrap: wrap` agregado a 2 contenedores de botones en templates JS (proyectos en config, botones de trabajador en personal)
- **HTML - form-grid-1**: grid inline en formulario de insumos reemplazado con clase `.form-grid-1`

### v2.7.0 (2026-08-26) — Optimizaciones móviles (Android / iOS)
- **CSS - scroll global**: `html { scroll-behavior: smooth }` para scroll suave nativo en toda la app
- **CSS - iOS auto-zoom**: `-webkit-text-size-adjust: 100%` en `body` previene el zoom automático de texto en landscape
- **CSS - pull-to-refresh**: `overscroll-behavior-y: none` en `body` evita el gesto accidental de pull-to-refresh en Android Chrome
- **CSS - tap delay**: `touch-action: manipulation` en todos los botones, tabs y controles interactivos elimina el retraso de 300ms en tap
- **CSS - GPU animations**: `will-change: transform` en botones y tabs para capas GPU en animaciones de scale
- **CSS - nav-tabs táctil**: scroll horizontal con `overflow-x: auto` + `scroll-snap-type` para deslizamiento suave entre tabs en móvil
- **CSS - modales móvil**: `max-height: 90dvh + overflow-y: scroll` en `.modal-content` para modales correctamente scrollables en móvil
- **CSS - breakpoint 768px**: mejorado — `td button` con `min-height: 36px` para touch targets en tablas
- **CSS - breakpoint 480px (NUEVO)**: Android mid-range — grid a 1 columna, fuentes ajustadas, botones a `width: 100%`
- **CSS - breakpoint 390px (NUEVO)**: iPhone 14/15 Pro — ajustes finos de tipografía y espaciado
- **CSS - breakpoint 360px (NUEVO)**: Galaxy S / Moto G — reemplaza el breakpoint anterior de 375px con reglas más completas
- **HTML - teclado decimal**: `inputmode="decimal"` agregado a los 24 inputs `type="number"` — iOS muestra teclado con punto decimal, Android mejora el teclado numérico
- **HTML - autocomplete**: `autocomplete="off"` en los 11 formularios de campo/obra para evitar sugerencias no deseadas en los campos (código de equipo, responsable, descripción de trabajo, etc.)

### v2.6.0 (2026-08-24) — Más tipos de maquinaria y categorías de gasto
- **Maquinaria**: nuevos tipos de unidad en el formulario (excavadora, minicargador, bobcat/cargadora frontal, grúa, motoniveladora/patrol, rodillos 8/10/12T, compactadora, vibrocompactadora, camión de carga) con medición correcta por horas o km
- **Maquinaria**: catálogo de mantenimiento ampliado con `Minicargador` y `Bobcat / Cargadora Frontal` y sus formatos de inspección
- **Caja Chica**: 30 nuevas categorías de gasto en campo de obra (mano de obra, salarios, EPI, alquiler de equipo, fletes, viáticos, energía, señalización, demolición, instalaciones, desechos, andamios, botiquín, vigilancia, seguros, lubricantes, neumáticos, laboratorio, permisos, impuestos, etc.) sin duplicar las existentes
- **UX**: se muestran las categorías con etiquetas legibles (tabla, PDF y CSV) en vez de códigos internos
- **Arquitectura**: mapeos `MAQ_TIPOS` y `CATEGORIAS_CAJA` + helpers `esHorasMaquinaria`, `claveMaquinariaPorNombre`, `etiquetaCategoria`

### v2.5.0 (2026-08-24) — Nuevo icono de instalación (logocr.png)
- **Nuevo icono**: se reemplazó el icono de la app por `logocr.png` (1024×1024)
- **PWA**: se generaron variantes `icon-512.png` y `icon-192.png` y se declararon en `manifest.json` (any + maskable) y en los shortcuts
- **PWA**: favicon, `apple-touch-icon` y `msapplication-TileImage` apuntan al nuevo logo; Service Worker cachea las variantes y se bumpeó a v2.5.0 para que los instalados actualicen el icono

### v2.4.0 (2026-08-24) — Corrección de consistencia en Maquinaria (QA)
- **Bug**: Al editar un registro de maquinaria ya no se desbalancea la caja: el egreso vinculado se ajusta al nuevo gasto (o se crea/elimina según corresponda)
- **Bug**: Al eliminar un registro de maquinaria se revierte el monto EXACTO del egreso vinculado (eliminándolo directamente) en lugar de crear un reembolso duplicado
- **Mejora**: `procesarGastoCajaChica()` devuelve el movimiento creado para vincular el `gasto_id` del egreso con cada registro de maquinaria (con fallback por descripción para datos migrados)
- **Arquitectura**: nueva función `ajustarGastoMaquinaria()` para recalcular el gasto en ediciones

### v2.3.0 (2026-08-24) — Respaldo en la Nube
- **Nuevo**: Módulo «☁️ Respaldo en la Nube» en Configuración
- **Nuevo**: Google Apps Script (recomendado, sin registro de OAuth) guarda en tu propia Google Drive: un archivo por día + `latest.json`, con auto-subida (debounce) tras cada guardado y botón «Restaurar desde la Nube» (fusión con tus datos)
- **Nuevo**: Estructura de credenciales para métodos avanzados (Google Drive API y OneDrive/Microsoft Graph con Client ID + token)
- **Arquitectura**: `saveDB()` (punto único de escritura) dispara el auto-respaldo en la nube
- **DB**: `configuracion.nube` con proveedor, URL guardada y última fecha de respaldo

### v2.2.0 (2026-08-24) — Rediseño visual corporativo
- **UI**: Fondo con degradado del logotipo (azul profundo → cian → púrpura) sobre oscuro, con granulado global (vidrio granulado desenfocado)
- **UI**: Tarjetas, KPIs, botones, formularios y navegación con glassmorphism translúcido, `backdrop-filter` + desenfoque y halo de gradiente corporativo
- **UI**: Contraste reforzado en placeholders, estados de foco, encabezados de tabla, tab activo y botones
- **SW**: Service Worker y caché actualizados a v2.2.0 para propagar el rediseño a usuarios instalados

### v2.1.0 (2026-08-24) — Panel de Resumen y optimizaciones
- **Nuevo**: 📊 Panel de Resumen Ejecutivo con KPIs (saldo, ingresos/egresos, viajes, km, mantenimiento, nómina), alertas de fondos bajos/negativos, alertas de stock mínimo de insumos y lista de pendientes del día
- **Nuevo**: Atajo de teclado Alt+1..9 y shortcut PWA al Panel de Resumen
- **Nuevo**: Campo de "stock mínimo" en compras de insumos con alerta automática en el Resumen
- **Optimización**: responsive móvil Android/iOS confirmado (safe-area, botones 44px, tablas con scroll táctil, breakpoints 768px/375px)
- **Cambios internos**: versión unificada y cache del Service Worker actualizado a v2.1.0

### v2.0.0 (2026-08-24) — Viajes, Mantenimiento y Reportes consolidados
- **Nuevo**: 📊 Panel de Resumen Ejecutivo (tab "Resumen") con KPIs de saldo, ingresos/egresos, viajes, km recorridos, mantenimiento e insumos, nómina, más alertas de fondos bajos/negativos, stock mínimo y pendientes del día
- **Nuevo**: 🚛 Módulo de Control de Viajes de Camiones (rutas al botadero con distancia, tipo de material, camiones propios con consumo de combustible estimado por km, camiones alquilados con tarifa por día o por viaje y descuento automático a caja)
- **Nuevo**: 🔧 Módulo de Mantenimiento y Control de Insumos (catálogo de maquinaria, formatos de inspección preventivo/correctivo por tipo de equipo, órdenes de mantenimiento y compras de repuestos, aceites, hidráulicos y combustible) con campo de stock mínimo y alerta automática
- **Nuevo**: Exportación a XLSX con SheetJS además de PDF y CSV
- **Nuevo**: Atajo de teclado ampliado a Alt+1..9 (Resumen, Caja Chica, ... Configuración) y shortcut PWA al Panel de Resumen
- **Mejora**: Reportes diario y semanal consolidados (caja chica + viajes + mantenimiento + insumos) en PDF, CSV y XLSX
- **Mejora**: Plantilla de PDF con membrete corporativo, firmas y pie de página numerado
- **Crítico**: `construramsa_db.json` corregido (estructura multi-proyecto válida con `viajes_camiones` y `mantenimiento` correctamente anidados)
- **Bajo**: Corregido doble `hideLoading()` en la importación de datos
- **DB**: Semilla ampliada con datos de ejemplo de viajes y mantenimiento en el proyecto "Residencial Los Pinos"

### v1.1.0 (2026-08-24) — Correcciones técnicas
- **Crítico**: Arquitectura multi-proyecto unificada con `getProyectoData()`/`saveProyectoData()`
- **Crítico**: Eliminado doble bloque `DOMContentLoaded`
- **Crítico**: Service Worker corregido a ruta relativa `./sw.js` con `scope: './'`
- **Alto**: Reportes PDF y CSV distinguen ingresos/egresos con saldo neto
- **Alto**: Eliminación de movimientos sin generar registros de reembolso fantasma
- **Medio**: Reemplazados todos los `alert()`/`confirm()` nativos por UI personalizada
- **Medio**: Estado vacío en todas las tablas (`📭 No hay registros`)
- **Medio**: Paginación de 20 registros por página en tablas de historial
- **Medio**: Cache de sesión para `getDB()` evita deserializar JSON en cada llamada
- **Medio**: Colores corregidos para cumplir WCAG AA (púrpura `#a855f7`, footer PDF `#6B7280`)
- **Medio**: `aria-live`, `role="status"` y `aria-label` en todos los controles interactivos
- **Medio**: Badge de proyecto activo prominente con animación de alerta cuando no hay proyecto
- **Bajo**: Rendimiento de maquinaria muestra `N/A` cuando no hay galones registrados
- **Bajo**: Clases CSS reales `.form-grid-2/3` reemplazan selectores de atributo frágiles
- **Bajo**: Breakpoint adicional para pantallas ≤375px
- **DB**: `construramsa_db.json` corregido (logo limpio, campos multi-proyecto agregados)
- **SW**: Service Worker v1.1.0 con `clients.claim()`, `skipWaiting()` automático y cache robusto
- **Manifest**: Ícono SVG agregado, shortcuts PWA para Caja Chica y Reportes

### v1.0.0 — Versión inicial
- Lanzamiento inicial con módulos de Caja Chica, Maquinaria, Personal y Adquisiciones

## Respaldo en la Nube (Google Drive / OneDrive)

La app puede respaldar **automáticamente** tus datos en tu propia cuenta para que no se pierdan aunque desinstales y reinstales la app.

### Método recomendado: Google Apps Script (sin credenciales OAuth)
1. Ve a [https://script.google.com](https://script.google.com) → crea un proyecto nuevo.
2. En la app: **Configuración → ☁️ Respaldo en la Nube** → pulsa **«📋 Copiar Script»**.
3. Pega el script en el proyecto, Guarda y ejecuta `crearCarpetaPrueba` (autoriza).
4. **Ver → Implementar como App Web**: *Ejecutar como* = tú · *Quién puede acceder* = Cualquiera. Copia la URL que termina en `/exec`.
5. Pega esa URL en el campo **URL del Web App**, pulsa **💾 Guardar Configuración** y luego **⬆️ Subir a la Nube**.
6. De ahí en adelante, **cada vez que guardes datos se respaldan solos** (auto-subida con debounce). Para recuperar tras reinstalar: **⬇️ Restaurar desde la Nube** (fusiona con tus datos).

Se crea en tu Google Drive la carpeta **`CONSTRURAMSA_Backups`** con un archivo por día (`construramsa_AAAA-MM-DD.json`) y el más reciente (`construramsa_latest.json`).

### Métodos avanzados (OAuth)
El módulo también admite **Google Drive API** y **OneDrive / Microsoft Graph**, ingresando un *Client ID (y token)* de una app registrada con un Redirect URI configurado. Requiere registrar la aplicación en Google Cloud / Azure; por simplicidad y 100% offline se recomienda Google Apps Script.

## Soporte

Para soporte técnico o reporte de problemas, contacte al equipo de desarrollo de CONSTRURAMSA.

## Compatibilidad Móvil (Android / iOS)

La aplicación es una PWA instalable y 100% responsive, optimizada para uso en campo:

- **Android (Chrome)**: instalable como app nativa desde el menú "Agregar a pantalla principal"; se abre en modo *standalone* a pantalla completa.
- **iOS (Safari)**: `apple-mobile-web-app-capable`, icono de inicio (`apple-touch-icon`), barras `black-translucent` y soporte de *safe-area* del notch/Dynamic Island (`env(safe-area-inset-*)`). Añadir a pantalla de inicio: botón Compartir → "Añadir a pantalla de inicio".
- **Responsive**: breakpoints a 768px y 375px que apilan formularios, centran la navegación, reducen tipografía, ajustan tarjetas y permiten scroll horizontal con gesto táctil en las tablas de datos.
- **Touch optimizado**: botones con altura mínima de 44px (WCAG target size), sin `:hover` dependiente en móvil, y `-webkit-tap-highlight-color` desactivado.
- **Atajos de teclado** (Alt+1..9) para equipos de oficina.

> **Nota**: al abrir la app por primera vez conviene estar conectado para precargar las librerías PDF (html2pdf) y XLSX (SheetJS) en el caché del Service Worker. Luego funciona 100% offline.

---

**Versión**: 2.7.2  
**Desarrollado para**: CONSTRURAMSA — Soluciones en Ingeniería y Arquitectura  
**Moneda**: Quetzales (Q) — Guatemala

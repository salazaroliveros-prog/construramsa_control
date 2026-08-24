# CONSTRURAMSA - Control de Obra

Aplicación Web Progresiva (PWA) para el control de gastos y gestión de obra de CONSTRURAMSA.

## Características

- **100% Offline**: Funciona completamente sin conexión a internet usando LocalStorage
- **Diseño Glasmorphism Premium**: Interfaz moderna con efectos de cristal y paleta corporativa
- **Sistema Monetario en Quetzales (Q)**: Todos los montos expresados en moneda nacional de Guatemala
- **Multi-Proyecto**: Gestión de múltiples proyectos con datos completamente aislados por proyecto
- **Módulos Completos**:
  - 💰 Caja Chica e Insumos con validación de saldo por proyecto
  - 🚜 Maquinaria y Flota con cálculos automáticos de rendimiento (N/A cuando sin combustible)
  - 👷 Personal, Asistencia y Nómina con cálculo de horas extra
  - 📋 Adquisiciones y Proveedores con cotizaciones
- **Reportes Profesionales**: PDF y CSV con desglose de ingresos, egresos y saldo neto
- **Compartir por WhatsApp**: Integración con Web Share API
- **Respaldo de Datos**: Exportación e importación con fusión inteligente
- **Accesibilidad WCAG 2.1 AA**: Contraste de colores corregido, aria-live, aria-label en todos los controles
- **Paginación**: Tablas de historial paginadas a 20 registros por página
- **PWA Completa**: Service Worker v1.1.0 con activación inmediata y cache robusto

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
| `sw.js` | Service Worker v1.1.0 para funcionalidad offline |
| `manifest.json` | Configuración PWA con shortcuts de módulos |
| `icon.png` | Icono corporativo (192×192px) |
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

## Soporte

Para soporte técnico o reporte de problemas, contacte al equipo de desarrollo de CONSTRURAMSA.

---

**Versión**: 1.1.0  
**Desarrollado para**: CONSTRURAMSA — Soluciones en Ingeniería y Arquitectura  
**Moneda**: Quetzales (Q) — Guatemala

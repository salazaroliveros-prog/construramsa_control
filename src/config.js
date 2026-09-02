/**
 * @fileoverview Configuración centralizada de CONSTRURAMSA Control de Obra.
 *
 * Todos los "magic strings", constantes de la aplicación, umbrales, colores
 * corporativos y configuración de exportación se definen aquí.
 *
 * El módulo está aislado en un IIFE para NO contaminar el scope global:
 * expone un único objeto congelado `window.CR_CONFIG` (o `module.exports`
 * en entornos CommonJS/Node). Al encapsular las constantes no colisiona con
 * `APP_VERSION`, que ya vive dentro del bundle de `index.html`.
 *
 * Carga desde index.html (después de los vendor scripts):
 *   <script src="./src/types.js"></script>
 *   <script src="./src/config.js"></script>
 *
 * @module config
 */

(function (globalScope) {
    'use strict';

    /**
     * Versión actual de la aplicación.
     * DEBE mantenerse sincronizada con:
     *   - package.json → "version"
     *   - sw.js → CACHE_NAME
     *   - index.html → APP_VERSION + UI "Versión:"
     *   - construramsa_db.json → db.version
     * @type {string}
     */
    const APP_VERSION = '2.9.1';

    /**
     * Clave en localStorage donde se persiste la base de datos.
     * @type {string}
     */
    const DB_STORAGE_KEY = 'construramsa_db';

    /**
     * Clave para el respaldo previo a importación.
     * @type {string}
     */
    const DB_BACKUP_KEY = 'construramsa_preimport_backup';

    /**
     * @typedef {Object} AppConstants
     * @property {string} version
     * @property {string} dbKey
     * @property {string} dbBackupKey
     * @property {string} empresaDefault
     * @property {string} esloganDefault
     * @property {string} moneda
     * @property {ReadonlyArray<string>} modulosDisponibles
     * @property {Record<string, string>} etiquetasModulo
     * @property {Record<string, string>} etiquetasReporte
     */

    /**
     * Catálogo completo de constantes de la aplicación.
     * Patrón Singleton / Module para evitar mutaciones accidentales.
     * @type {Readonly<AppConstants>}
     */
    const APP_CONFIG = Object.freeze({
        version: APP_VERSION,
        dbKey: DB_STORAGE_KEY,
        dbBackupKey: DB_BACKUP_KEY,
        empresaDefault: 'CONSTRURAMSA',
        esloganDefault: 'SOLUCIONES EN INGENIERÍA Y ARQUITECTURA',
        moneda: 'Q',

        /** Módulos disponibles en la navegación. */
        modulosDisponibles: Object.freeze([
            'resumen', 'caja-chica', 'maquinaria', 'personal',
            'adquisiciones', 'viajes', 'mantenimiento', 'reportes', 'configuracion'
        ]),

        /** Etiquetas humanas para cada módulo (usado en reportes y UI). */
        etiquetasModulo: Object.freeze({
            'resumen': 'Panel de Resumen',
            'caja-chica': 'Caja Chica e Insumos',
            'maquinaria': 'Maquinaria y Flota',
            'personal': 'Personal y Nómina',
            'adquisiciones': 'Adquisiciones y Proveedores',
            'viajes': 'Viajes de Camiones',
            'mantenimiento': 'Mantenimiento e Insumos',
            'reportes': 'Reportes Profesionales',
            'configuracion': 'Configuración'
        }),

        /** Etiquetas humanas para cada tipo de reporte. */
        etiquetasReporte: Object.freeze({
            'diario': 'Diario',
            'semanal': 'Semanal',
            'mensual': 'Mensual'
        })
    });

    /**
     * Paleta de colores corporativos para exportaciones.
     * Debe mantenerse en sincronía con las variables CSS `--pdf-*` de index.html.
     * @typedef {Object} PaletaCorporativa
     * @property {string} primario   - Azul oscuro corporativo.
     * @property {string} secundario - Azul claro/cian.
     * @property {string} grisOscuro - Texto principal.
     * @property {string} grisMedio  - Texto secundario.
     * @property {string} grisClaro  - Bordes y fondos sutiles.
     * @property {string} rojo       - Totales de egreso.
     * @property {string} verde      - Totales de ingreso.
     * @property {string} blanco     - Fondo blanco.
     * @property {string} fondoClaro - Fondo de filas alternas.
     */
    const PALETA_CORPORATIVA = Object.freeze({
        primario:   '#004B93',
        secundario: '#00A4E4',
        grisOscuro: '#374151',
        grisMedio:  '#6B7280',
        grisClaro:  '#9CA3AF',
        rojo:       '#DC2626',
        verde:      '#059669',
        blanco:     '#ffffff',
        fondoClaro: '#F9FAFB'
    });

    /**
     * Configuración de exportación.
     * @typedef {Object} ExportConfig
     * @property {number} maxRowsPerPage   - Límite de filas por hoja en XLSX/PDF.
     * @property {string} csvEncoding      - Codificación CSV (BOM garantizado).
     * @property {boolean} csvFormulaGuard - Proteger contra inyección de fórmulas.
     * @property {boolean} xlsxUseExcelJS  - Preferir ExcelJS sobre SheetJS.
     * @property {number} pdfScale         - Escala de renderizado de html2pdf.
     * @property {number} pdfQuality       - Calidad JPEG (0-1).
     */
    const EXPORT_CONFIG = Object.freeze({
        maxRowsPerPage: 40,
        csvEncoding: 'utf-8',
        csvFormulaGuard: true,
        xlsxUseExcelJS: true,
        pdfScale: 1.0,
        pdfQuality: 0.95
    });

    /**
     * Configuración de paginación de tablas.
     * @typedef {Object} PaginationConfig
     * @property {number} itemsPerPage  - Elementos por página en tablas.
     * @property {number} maxPagesShown - Páginas visibles en el paginador.
     */
    const PAGINATION_CONFIG = Object.freeze({
        itemsPerPage: 20,
        maxPagesShown: 5
    });

    /**
     * Plantilla corporativa estricta usada en los documentos exportados.
     * @typedef {Object} PlantillaCorporativa
     * @property {string} pieFirma          - Pie de cada documento exportado.
     * @property {ReadonlyArray<{nombre: string, cargo: string}>} firmasAutorizadas
     * @property {string} avisoLegal        - Texto legal de trazabilidad.
     * @property {string} numeroCorrelativo - Etiqueta del folio correlativo.
     */
    const PLANTILLA_CORPORATIVA = Object.freeze({
        pieFirma: 'Documento generado por el Sistema de Control de Obra CONSTRURAMSA.',
        firmasAutorizadas: Object.freeze([
            { nombre: 'Arq. Wilson Dario Salazar', cargo: 'Jefe de Proyectos' },
            { nombre: 'Ing. Juan Luis Ramirez Jimenez', cargo: 'Gerente Comercial' }
        ]),
        avisoLegal: 'Los valores expresados son en Quetzales (GTQ).',
        numeroCorrelativo: 'No. FOLIO'
    });

    /**
     * API pública del módulo, congelada para evitar mutaciones.
     * @type {Readonly<object>}
     */
    const api = Object.freeze({
        APP_VERSION,
        APP_CONFIG,
        PALETA_CORPORATIVA,
        EXPORT_CONFIG,
        PAGINATION_CONFIG,
        PLANTILLA_CORPORATIVA
    });

    /**
     * Exposición en navegador: un único global congelado y no enumerable.
     */
    if (globalScope) {
        try {
            Object.defineProperty(globalScope, 'CR_CONFIG', {
                value: api,
                writable: false,
                enumerable: false,
                configurable: false
            });
        } catch (e) {
            /* Entornos restringidos: la definición falla pero el módulo sigue vivo. */
        }
    }

    /**
     * Exposición CommonJS para testing / SSR.
     */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
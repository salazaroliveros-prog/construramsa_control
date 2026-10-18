/**
 * @fileoverview Configuración única de exportación para CONSTRURAMSA.
 *
 * Centraliza: tamaños de hoja (A4/Letter/Legal), márgenes estándares,
 * paleta corporativa, paginación de PDF/CSV/XLSX y opciones de renderizado.
 * Es la fuente de verdad para todos los módulos de exportación.
 *
 * @module exportConfig
 */

(function (globalScope) {
  'use strict';

  // ── Tamaños de hoja (mm) ───────────────────────────────────────────
  const PAGE_SIZES = Object.freeze({
    a4: { nombre: 'A4', ancho: 210, alto: 297 },
    letter: { nombre: 'Letter', ancho: 216, alto: 279 },
    legal: { nombre: 'Legal', ancho: 216, alto: 356 },
  });

  // ── Márgenes estándares (mm) ───────────────────────────────────────
  // Top/Right/Left uniformes de 12mm, Bottom 16mm (espacio para numeración).
  const MARGENES_PDF = Object.freeze({
    top: 12,
    right: 12,
    bottom: 16,
    left: 12,
  });

  // ── Área imprimible (mm) ───────────────────────────────────────────
  const AREA_IMPRIMIBLE_A4 = Object.freeze({
    ancho: 210 - MARGENES_PDF.left - MARGENES_PDF.right, // 186mm
    alto: 297 - MARGENES_PDF.top - MARGENES_PDF.bottom, // 269mm
  });

  // ── Paleta corporativa (sincronizada con CR_CONFIG.PALETA_CORPORATIVA) ──
  const PALETA = Object.freeze({
    primario: '#004B93', // Azul oscuro corporativo
    secundario: '#00A4E4', // Cian corporativo
    grisOscuro: '#374151', // Texto principal
    grisMedio: '#6B7280', // Texto secundario / pies de página
    grisClaro: '#9CA3AF', // Bordes sutiles
    grisFondo: '#F9FAFB', // Filas alternas
    rojo: '#DC2626', // Egresos / alertas
    verde: '#059669', // Ingresos / positivos
    blanco: '#FFFFFF', // Fondo blanco
    acento: '#7C3AED', // Púrpura acento
  });

  // ── Tipografía estándar PDF ────────────────────────────────────────
  const TIPOGRAFIA = Object.freeze({
    familia: 'Arial, Helvetica, sans-serif',
    tamanoBase: '10px',
    tamanoTitulo: '14px',
    tamanoSubtitulo: '12px',
    tamanoTabla: '9px',
    tamanoFooter: '8px',
    tamanoCabeceraTabla: '8.5px',
    pesoBold: '700',
    pesoNormal: '400',
  });

  // ── Configuración de exportación ───────────────────────────────────
  const EXPORT_CONFIG = Object.freeze({
    // Escala de alta resolución de html2canvas para PDF. La compresión JPEG
    // no recupera detalle perdido cuando el canvas se rasteriza a 1:1.
    pdfScale: 1.5,
    pdfImageQuality: 0.95,
    csvBom: true,
    csvSeparator: ',',
    csvLineEnding: '\r\n',
    xlsxSheetName: 'Reporte',
    maxFilasHojaXLSX: 100000, // Límite práctico de SheetJS por hoja
    repetirCabeceraTabla: true,
    romperFilasTabla: false, // page-break-inside: avoid en todas las filas
  });

  // ── Tipos de reporte soportados ────────────────────────────────────
  const REPORT_TYPES = Object.freeze([
    'diario',
    'semanal',
    'mensual',
    'asistencia',
    'nomina',
    'viajes',
    'mantenimiento',
    'categoria',
    'ejecutivo',
  ]);

  // ── Formatos de exportación soportados ─────────────────────────────
  const EXPORT_FORMATS = Object.freeze(['pdf', 'csv', 'xlsx']);

  /**
   * Conserva la nitidez de los reportes habituales y limita el uso de memoria
   * sólo cuando un documento excepcionalmente largo requiere un canvas menor.
   */
  function pdfScaleForHeight(documentHeight) {
    return Number(documentHeight) > 8000 ? 1.2 : EXPORT_CONFIG.pdfScale;
  }

  // ── CSS @page listo para inyectar (márgenes estándar) ──────────────
  function cssPage(pageSize = 'a4') {
    const size = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
    const m = MARGENES_PDF;
    return (
      '@page {' +
      'size: ' +
      size.ancho +
      'mm ' +
      size.alto +
      'mm portrait;' +
      'margin: ' +
      m.top +
      'mm ' +
      m.right +
      'mm ' +
      m.bottom +
      'mm ' +
      m.left +
      'mm;' +
      '@bottom-left { content: "CONSTRURAMSA"; font-size: ' +
      TIPOGRAFIA.tamanoFooter +
      '; color: ' +
      PALETA.grisMedio +
      '; }' +
      '@bottom-center { content: attr(data-fecha-gen); font-size: ' +
      TIPOGRAFIA.tamanoFooter +
      '; color: ' +
      PALETA.grisMedio +
      '; }' +
      '@bottom-right { content: counter(page) " / " counter(pages); font-size: ' +
      TIPOGRAFIA.tamanoFooter +
      '; color: ' +
      PALETA.grisMedio +
      '; }' +
      '}' +
      '@page :first { @bottom-left { content: none; } @bottom-center { content: none; } }'
    );
  }

  // ── Estilo de contenedor raíz para impresión ───────────────────────
  function estiloContenedorImpresion(pageSize = 'a4') {
    const size = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
    const m = MARGENES_PDF;
    return (
      'font-family:' +
      TIPOGRAFIA.familia +
      ';' +
      'font-size:' +
      TIPOGRAFIA.tamanoBase +
      ';' +
      'color:' +
      PALETA.grisOscuro +
      ';' +
      'background:' +
      PALETA.blanco +
      ';' +
      'width:' +
      size.ancho +
      'mm;' +
      'min-height:' +
      size.alto +
      'mm;' +
      'padding:' +
      m.top +
      'mm ' +
      m.right +
      'mm ' +
      m.bottom +
      'mm ' +
      m.left +
      'mm;' +
      'box-sizing:border-box;' +
      'overflow:visible;'
    );
  }

  // ── API pública ────────────────────────────────────────────────────
  const api = Object.freeze({
    PAGE_SIZES,
    MARGENES_PDF,
    AREA_IMPRIMIBLE_A4,
    PALETA,
    TIPOGRAFIA,
    EXPORT_CONFIG,
    REPORT_TYPES,
    EXPORT_FORMATS,
    pdfScaleForHeight,
    cssPage,
    estiloContenedorImpresion,
    /** Devuelve el ancho imprimible en mm para una hoja dada. */
    areaAncho: function (pageSize) {
      const s = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
      return s.ancho - MARGENES_PDF.left - MARGENES_PDF.right;
    },
    /** Devuelve el alto imprimible en mm para una hoja dada. */
    areaAlto: function (pageSize) {
      const s = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
      return s.alto - MARGENES_PDF.top - MARGENES_PDF.bottom;
    },
  });

  if (globalScope) {
    try {
      Object.defineProperty(globalScope, 'CR_ExportConfig', {
        value: api,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    } catch (_e) {
      /* entornos restringidos */
    }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * plantillaPremium.js — Estándares visuales centralizados para PDFs y reportes
 * CONSTRURAMSA v2.9.0
 *
 * Expone CR_PlantillaPremium con la constante TEMPLATE_PREMIUM que contiene
 * paleta, márgenes y tipografía canónicos. Todos los módulos de generación de
 * reportes pueden importarlo para garantizar consistencia visual.
 *
 * Patrón: IIFE + Object.freeze (browser) + module.exports (Node/Playwright)
 */
(function (globalScope) {
    'use strict';

    /**
     * Paleta corporativa CONSTRURAMSA.
     * Fuente de verdad visual — sincronizada con CR_CONFIG.PALETA_CORPORATIVA.
     */
    var PALETA = Object.freeze({
        azulPrimario:  '#004B93',   // Azul corporativo principal
        cianAcento:    '#00A4E4',   // Cian corporativo secundario
        grisTinto:     '#374151',   // Texto oscuro principal
        grisMedio:     '#6B7280',   // Texto secundario / pies de página
        grisClaro:     '#E5E7EB',   // Bordes de tabla
        grisFondo:     '#F9FAFB',   // Filas pares / fondos alternos
        rojo:          '#DC2626',   // Alertas / egresos
        verde:         '#059669',   // Positivos / ingresos
        blanco:        '#FFFFFF'
    });

    /**
     * Márgenes estándar A4 (12mm uniformes + extra en bottom para numeración).
     * Compatible con la directiva @page del CSS corporativo.
     */
    var MARGENES = Object.freeze({
        top:    '12mm',
        right:  '12mm',
        bottom: '16mm',   // Espacio adicional para el footer numerado
        left:   '12mm'
    });

    /**
     * Tipografía estándar para reportes PDF.
     * Todos los valores son strings CSS listos para usar.
     */
    var TIPOGRAFIA = Object.freeze({
        familia:        'Arial, Helvetica, sans-serif',
        tamanoBase:     '10px',
        tamanoTitulo:   '14px',
        tamanoSubtitulo:'12px',
        tamanoTabla:    '9px',
        tamanoFooter:   '9px',
        pesoBold:       '700',
        pesoNormal:     '400'
    });

    /**
     * Área imprimible calculada para A4.
     * anchoPagina  = 210mm - margenIzq(12) - margenDer(12)  = 186mm
     * altoPagina   = 297mm - margenSup(12) - margenInf(16)  = 269mm
     */
    var DIMENSIONES_A4 = Object.freeze({
        ancho:  '210mm',
        alto:   '297mm',
        areaAncho: '186mm',
        areaAlto:  '269mm'
    });

    /**
     * CSS @page mínimo que deben incluir todos los reportes PDF.
     * Puede concatenarse directamente al inicio de una hoja de estilos inline.
     */
    var CSS_PAGE = '@page{margin:12mm 12mm 16mm 12mm;}'
        + '@page{@bottom-left{content:"CONSTRURAMSA";font-size:8pt;color:#6B7280;}}'
        + '@page{@bottom-center{content:attr(data-empresa);font-size:8pt;color:#6B7280;}}'
        + '@page{@bottom-right{content:counter(page) " / " counter(pages);font-size:8pt;color:#6B7280;}}';

    // ── API pública ──────────────────────────────────────────────────────────

    var api = Object.freeze({
        /** Paleta de colores corporativa CONSTRURAMSA */
        PALETA: PALETA,
        /** Márgenes estándar A4 */
        MARGENES: MARGENES,
        /** Tipografía estándar para PDFs */
        TIPOGRAFIA: TIPOGRAFIA,
        /** Dimensiones físicas de una página A4 y su área imprimible */
        DIMENSIONES_A4: DIMENSIONES_A4,
        /** CSS @page listo para insertar en estilos inline de reportes */
        CSS_PAGE: CSS_PAGE,

        /**
         * Devuelve un objeto de estilo inline para el contenedor raíz del PDF.
         * @returns {string}  Atributo style listo para pegar en HTML.
         */
        estiloContenedor: function () {
            return 'font-family:' + TIPOGRAFIA.familia + ';'
                + 'font-size:' + TIPOGRAFIA.tamanoBase + ';'
                + 'color:' + PALETA.grisTinto + ';'
                + 'width:' + DIMENSIONES_A4.ancho + ';'
                + 'max-width:100%;'
                + 'padding:' + MARGENES.top + ' ' + MARGENES.right + ' ' + MARGENES.bottom + ' ' + MARGENES.left + ';'
                + 'box-sizing:border-box;';
        },

        /**
         * Devuelve el color de una clave de la paleta, con fallback al valor raw.
         * @param {string} clave  Nombre de la clave en PALETA (e.g. 'azulPrimario')
         * @param {string} [fallback='#374151']
         * @returns {string}
         */
        color: function (clave, fallback) {
            return PALETA[clave] || (fallback || '#374151');
        }
    });

    // ── Exposición browser / Node ────────────────────────────────────────────

    if (globalScope) {
        try {
            Object.defineProperty(globalScope, 'CR_PlantillaPremium', {
                value:        api,
                writable:     false,
                enumerable:   false,
                configurable: false
            });
        } catch (_e) { /* entornos restringidos */ }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

})(typeof window !== 'undefined' ? window : globalThis);

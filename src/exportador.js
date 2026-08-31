/**
 * @fileoverview Utilidades de exportación profesional para CONSTRURAMSA.
 *
 * Helpers puros y tipados (sin efectos colaterales) que complementan la lógica
 * de exportación ya existente en `index.html` (PDF con html2pdf, XLSX con
 * ExcelJS/SheetJS y CSV). Aquí se centraliza la lógica de:
 *   - Sanitización de celdas CSV (protección contra inyección de fórmulas).
 *   - Serialización de filas/objetos a CSV con BOM UTF-8 y separador ";" (GT).
 *   - Formateo de montos con moneda y precisión consistente.
 *   - Generación de nombres de archivo seguros.
 *   - Descarga en navegador único punto de entrada.
 *
 * Se expone como `window.CR_Export` (IIFE, sin fuga de globales) y como
 * CommonJS para testing en Node.
 *
 * @module exportador
 */

(function (globalScope) {
    'use strict';

    /**
     * Caracteres que inician un ataque de inyección de fórmulas en CSV/XLSX.
     * @type {ReadonlyArray<string>}
     */
    const PREFIJOS_PELIGROSOS = Object.freeze(['=', '+', '-', '@', '\t', '\r']);

    /**
     * Calcula el total de un arreglo de movimientos con márgenes (evita NaN).
     * Solo se suman los movimientos cuyo `tipo` coincide exactamente con el
     * solicitado; los que no tienen tipo quedan excluidos de ambos totales.
     * @param {Array<{monto?: number, tipo?: string}>} [movimientos]
     * @param {'ingreso'|'egreso'} tipo
     * @returns {number}
     */
    function sumarPorTipo(movimientos, tipo) {
        if (!Array.isArray(movimientos)) return 0;
        return movimientos.reduce((acc, m) => {
            if (!m || m.tipo !== tipo) return acc;
            const monto = Number(m.monto);
            return Number.isFinite(monto) ? acc + monto : acc;
        }, 0);
    }

    /**
     * Protege un campo contra inyección de fórmulas anteponiendo una comilla
     * cuando el valor inicia con un prefijo peligroso.
     * @param {unknown} valor
     * @returns {string}
     */
    function escaparCampoCSV(valor) {
        if (valor === null || valor === undefined) return '';
        let str = String(valor);
        const primero = str.charAt(0);
        if (PREFIJOS_PELIGROSOS.includes(primero)) {
            str = "'" + str;
        }
        return str.replace(/"/g, '""');
    }

    /**
     * Serializa una fila (arreglo de celdas) a línea CSV.
     * @param {Array<unknown>} celdas
     * @returns {string}
     */
    function filaACsv(celdas) {
        return celdas.map(escaparCampoCSV).join(';');
    }

    /**
     * Serializa una celda CSV tal y como la exige el reporte consolidado de
     * `index.html`: normaliza saltos de línea, neutraliza fórmulas maliciosas
     * (prefixando una comilla simple), escapa comillas dobles y envuelve el
     * contenido entre comillas dobles. REPLICA exactamente el comportamiento
     * del helper local `csvCell` para no alterar el formato de salida.
     * @param {unknown} valor
     * @returns {string}
     */
    function celdaCSV(valor) {
        const text = String(valor ?? '').replace(/\r?\n/g, ' ');
        const safeText = /^[=+\-@]/.test(text.trim()) ? "'" + text : text;
        return '"' + safeText.replace(/"/g, '""') + '"';
    }

    /**
     * Serializa un arreglo de celdas a una línea CSV con separador ","
     * (formato del reporte consolidado). Los números usan 2 decimales fijos.
     * @param {ReadonlyArray<unknown>} valores
     * @returns {string}
     */
    function filaCSV(valores) {
        return valores.map(value => {
            if (typeof value === 'number') {
                const n = parseFloat(value);
                return (Number.isFinite(n) ? n : 0).toFixed(2);
            }
            return celdaCSV(value);
        }).join(',');
    }

    /**
     * Construye el contenido CSV completo a partir de cabeceras y filas.
     * Incluye BOM UTF-8 para compatibilidad con Excel en Windows.
     * @param {ReadonlyArray<string>} cabeceras
     * @param {ReadonlyArray<ReadonlyArray<unknown>>} filas
     * @returns {string}
     */
    function construirCSV(cabeceras, filas) {
        const lineas = [];
        lineas.push(filaACsv(cabeceras));
        for (const fila of filas) {
            lineas.push(filaACsv(fila));
        }
        return '\uFEFF' + lineas.join('\r\n');
    }

    /**
     * Formatea un monto como representación consistente con separador de miles,
     * 2 decimales y sin sufijo de moneda (para tablas/xlsx). Maneja NaN.
     * @param {number|string|null|undefined} valor
     * @param {number} [decimales]
     * @returns {string}
     */
    function formatearMonto(valor, decimales) {
        const num = Number(valor);
        const d = decimales === undefined ? 2 : decimales;
        if (!Number.isFinite(num)) return Number(0).toFixed(d);
        return num.toLocaleString('es-GT', {
            minimumFractionDigits: d,
            maximumFractionDigits: d
        });
    }

    /**
     * Normaliza un nombre de archivo eliminando caracteres no seguros.
     * @param {string} base
     * @returns {string}
     */
    function nombreArchivoSeguro(base) {
        const limpio = String(base)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '');
        return limpio || 'reporte';
    }

    /**
     * Dispara una descarga de blob en el navegador.
     * @param {Blob} blob
     * @param {string} nombreArchivo
     * @returns {boolean} true si se programó la descarga.
     */
    function descargarBlob(blob, nombreArchivo) {
        if (typeof URL === 'undefined' || !URL.createObjectURL) return false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        return true;
    }

    /**
     * API pública del módulo.
     */
    const api = Object.freeze({
        sumarPorTipo,
        escaparCampoCSV,
        filaACsv,
        celdaCSV,
        filaCSV,
        construirCSV,
        formatearMonto,
        nombreArchivoSeguro,
        descargarBlob
    });

    if (globalScope) {
        try {
            Object.defineProperty(globalScope, 'CR_Export', {
                value: api,
                writable: false,
                enumerable: false,
                configurable: false
            });
        } catch (e) { /* ignorar */ }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
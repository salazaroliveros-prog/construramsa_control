/**
 * @fileoverview Motor de consolidación de asistencia y nómina de CONSTRURAMSA.
 *
 * Agrupa los registros de asistencia (estructura { fecha, registros[] }) por
 * trabajador, calcula días asistidos, faltas, justificados, horas extra y el
 * total a pagar; todo dentro del rango de fechas indicado.
 *
 * Principios: funciones puras (FP), sin efectos secundarios, sin acceso al DOM
 * ni a localStorage. Recibe datos como parámetros y devuelve objetos planos.
 *
 * Expuesto como `window.CR_NominaEngine` (IIFE, sin fuga de globales) y como
 * CommonJS para testing en Node / Playwright.
 *
 * @module nominaEngine
 * @version 2.9.1
 */
(function (globalScope) {
    'use strict';

    /**
     * @typedef {Object} ResumenTrabajador
     * @property {string}  id             - ID del trabajador
     * @property {string}  nombre         - Nombre completo
     * @property {string}  puesto         - Cargo / puesto
     * @property {number}  pagoHoraNormal - Pago por hora normal (Q)
     * @property {number}  pagoHoraExtra  - Pago por hora extra (Q)
     * @property {number}  diasAsistidos  - Días con estado 'asistio'
     * @property {number}  diasFalta      - Días con estado 'falto'
     * @property {number}  diasJustificados - Días con estado 'justificado'
     * @property {number}  horasExtra     - Suma de horas extra del período
     * @property {number}  pagoNormal     - Subtotal horas normales (Q)
     * @property {number}  pagoExtra      - Subtotal horas extra (Q)
     * @property {number}  totalPagar     - Total a pagar al trabajador (Q)
     */

    /**
     * @typedef {Object} ResumenNomina
     * @property {ResumenTrabajador[]} trabajadores  - Fila por trabajador
     * @property {number} totalPagable   - Suma de todos los totales
     * @property {number} totalDiasAsistidos - Suma de días asistidos
     * @property {number} totalDiasFalta     - Suma de días falta
     * @property {number} totalHorasExtra    - Suma total horas extra
     * @property {number} cantidadTrabajadores - Trabajadores con al menos un registro
     */

    /**
     * Convierte cualquier valor a número finito; si no es finito devuelve 0.
     * @param {*} v
     * @returns {number}
     */
    function num(v) {
        var n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    /**
     * Normaliza una cadena de fecha a 'YYYY-MM-DD'.
     * @param {string|Date|null|undefined} v
     * @returns {string}
     */
    function fechaStr(v) {
        if (!v) return '';
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
        var d = new Date(v);
        if (isNaN(d.getTime())) return String(v);
        return d.toISOString().slice(0, 10);
    }

    /**
     * Consolida el historial de asistencia agrupando por trabajador.
     *
     * La estructura de entrada esperada es:
     *   asistencia = [{ fecha: 'YYYY-MM-DD', registros: [{ trabajador_id, estado, horas_extras, calculos }] }]
     *   trabajadores = [{ id, nombre, puesto, pago_hora_normal, pago_hora_extra }]
     *
     * Si se proveen fechaInicio / fechaFin solo se procesan los días dentro
     * del rango [fechaInicio, fechaFin] (inclusive, formato 'YYYY-MM-DD').
     *
     * @param {Object[]} trabajadores   - Catálogo de trabajadores del proyecto
     * @param {Object[]} asistencia     - Historial de asistencia (días)
     * @param {string}   [fechaInicio]  - 'YYYY-MM-DD' o ''
     * @param {string}   [fechaFin]     - 'YYYY-MM-DD' o ''
     * @returns {Object<string, ResumenTrabajador>} Mapa trabajador_id → resumen
     */
    function consolidarAsistencia(trabajadores, asistencia, fechaInicio, fechaFin) {
        var inicio = fechaInicio || '';
        var fin    = fechaFin    || '';

        /** @type {Object<string, ResumenTrabajador>} */
        var mapa = {};

        // Pre-indexar el catálogo para O(1) lookup
        var catalogoTrab = {};
        (Array.isArray(trabajadores) ? trabajadores : []).forEach(function (t) {
            if (t && t.id) catalogoTrab[t.id] = t;
        });

        (Array.isArray(asistencia) ? asistencia : []).forEach(function (dia) {
            if (!dia) return;
            var keyFecha = fechaStr(dia.fecha);
            // Filtrar por rango si se especificó
            if (inicio && keyFecha < inicio) return;
            if (fin   && keyFecha > fin)     return;

            (Array.isArray(dia.registros) ? dia.registros : []).forEach(function (reg) {
                if (!reg || !reg.trabajador_id) return;

                var tid = reg.trabajador_id;

                // Inicializar entrada si no existe
                if (!mapa[tid]) {
                    var t = catalogoTrab[tid] || {};
                    mapa[tid] = {
                        id:               tid,
                        nombre:           t.nombre  || 'Trabajador ' + tid,
                        puesto:           t.puesto  || '',
                        pagoHoraNormal:   num(t.pago_hora_normal),
                        pagoHoraExtra:    num(t.pago_hora_extra),
                        diasAsistidos:    0,
                        diasFalta:        0,
                        diasJustificados: 0,
                        horasExtra:       0,
                        pagoNormal:       0,
                        pagoExtra:        0,
                        totalPagar:       0
                    };
                }

                var entrada = mapa[tid];
                var estado  = String(reg.estado || '').toLowerCase().trim();
                var he      = num(reg.horas_extras || reg.horas_extras_cantidad);

                if (estado === 'asistio') {
                    entrada.diasAsistidos++;
                    entrada.horasExtra += he;

                    // Si el registro tiene calculos pre-computados los usamos,
                    // si no los calculamos desde las tarifas del trabajador.
                    if (reg.calculos && Number.isFinite(num(reg.calculos.total_diario))) {
                        entrada.pagoNormal += num(reg.calculos.pago_normal);
                        entrada.pagoExtra  += num(reg.calculos.pago_extra);
                        entrada.totalPagar += num(reg.calculos.total_diario);
                    } else {
                        var pagN = 8 * entrada.pagoHoraNormal;
                        var pagE = he  * entrada.pagoHoraExtra;
                        entrada.pagoNormal += pagN;
                        entrada.pagoExtra  += pagE;
                        entrada.totalPagar += pagN + pagE;
                    }
                } else if (estado === 'falto' || estado === 'falta') {
                    entrada.diasFalta++;
                } else if (estado === 'justificado') {
                    entrada.diasJustificados++;
                }
            });
        });

        return mapa;
    }

    /**
     * Genera el resumen ejecutivo de nómina a partir del mapa consolidado.
     *
     * @param {Object<string, ResumenTrabajador>} consolidado - Salida de consolidarAsistencia
     * @returns {ResumenNomina}
     */
    function generarResumenNomina(consolidado) {
        var lista = Object.values(consolidado || {});

        // Ordenar por nombre para presentación consistente
        lista.sort(function (a, b) {
            return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
        });

        var totalPagable         = 0;
        var totalDiasAsistidos   = 0;
        var totalDiasFalta       = 0;
        var totalHorasExtra      = 0;

        lista.forEach(function (t) {
            totalPagable       += t.totalPagar;
            totalDiasAsistidos += t.diasAsistidos;
            totalDiasFalta     += t.diasFalta;
            totalHorasExtra    += t.horasExtra;
        });

        return {
            trabajadores:          lista,
            totalPagable:          totalPagable,
            totalDiasAsistidos:    totalDiasAsistidos,
            totalDiasFalta:        totalDiasFalta,
            totalHorasExtra:       totalHorasExtra,
            cantidadTrabajadores:  lista.length
        };
    }

    /**
     * Atajo: consolida asistencia y devuelve directamente el ResumenNomina.
     *
     * @param {Object[]} trabajadores
     * @param {Object[]} asistencia
     * @param {string}   [fechaInicio]
     * @param {string}   [fechaFin]
     * @returns {ResumenNomina}
     */
    function calcularNomina(trabajadores, asistencia, fechaInicio, fechaFin) {
        var consolidado = consolidarAsistencia(trabajadores, asistencia, fechaInicio, fechaFin);
        return generarResumenNomina(consolidado);
    }

    // ── API pública ─────────────────────────────────────────────────────────
    var api = Object.freeze({
        consolidarAsistencia:  consolidarAsistencia,
        generarResumenNomina:  generarResumenNomina,
        calcularNomina:        calcularNomina
    });

    // ── Exposición en navegador ─────────────────────────────────────────────
    if (globalScope) {
        try {
            Object.defineProperty(globalScope, 'CR_NominaEngine', {
                value:        api,
                writable:     false,
                enumerable:   false,
                configurable: false
            });
        } catch (e) { /* entornos restringidos */ }
    }

    // ── Exposición CommonJS para Node / Playwright ─────────────────────────
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

})(typeof window !== 'undefined' ? window : globalThis);

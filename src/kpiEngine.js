/**
 * @fileoverview Motor funcional de KPIs para el dashboard de Resumen de CONSTRURAMSA.
 *
 * Funciones puras (FP), sin efectos secundarios, reutilizables y tipadas con JSDoc.
 * No depende del DOM; recibe datos estructurados (ver getProyectoData) y devuelve cálculos.
 *
 * Se expone como `window.CR_KPIEngine` (IIFE, sin fuga de globales) y como
 * CommonJS para testing en Node.
 *
 * @module kpiEngine
 * @version 2.9.0
 */
(function (globalScope) {
    'use strict';

    /**
     * @typedef {Object} KPIs
     * @property {number} presupuesto
     * @property {number} totalIngresos
     * @property {number} totalEgresos
     * @property {number} saldo
     * @property {number} movimientosIngreso
     * @property {number} movimientosEgreso
     * @property {number} totalViajes
     * @property {number} viajesPropios
     * @property {number} viajesAlquilados
     * @property {number} totalKm
     * @property {number} totalLitros
     * @property {number} totalMantenimiento
     * @property {number} totalNomina
     * @property {number} gastoDiarioPromedio
     * @property {number} proyeccionFinDeMes
     * @property {number} diasRestantes
     * @property {'excedera'|'dentro'|'sin_datos'} tendencia
     * @property {number} variacionMensual
     * @property {number} costoPorM3
     * @property {number} costoHoraMaquinaria
     * @property {number} eficienciaCombustible
     * @property {Object<string,number>} gastosPorCategoria - Claves = etiquetas legibles de categoría
     */

    /**
     * Suma montos de movimientos filtrados por tipo.
     * @param {Array<{tipo:string,monto:number}>} movimientos
     * @param {string} tipo
     * @returns {number}
     */
    const sumaTipo = (movimientos, tipo) =>
        (movimientos || []).filter(m => m.tipo === tipo).reduce((s, m) => s + (Number(m.monto) || 0), 0);

    /**
     * Cuenta movimientos por tipo.
     * @param {Array<{tipo:string}>} movimientos
     * @param {string} tipo
     * @returns {number}
     */
    const cuentaTipo = (movimientos, tipo) =>
        (movimientos || []).filter(m => m.tipo === tipo).length;

    /**
     * Ventana temporal (días del período) para proyecciones.
     * @private
     * @param {string} periodo - 'dia'|'semana'|'mes'|'trimestre'|'anio'
     * @param {Date} fechaHoy
     * @returns {{diasEnMes:number, diasTranscurridos:number, diasRestantes:number}}
     */
    const _ventanaPeriodo = (periodo, fechaHoy) => {
        const y = fechaHoy.getFullYear();
        const m = fechaHoy.getMonth();
        let diasEnMes = 0;
        let inicio = null;

        switch (periodo) {
            case 'mes': {
                diasEnMes = new Date(y, m + 1, 0).getDate();
                inicio = new Date(y, m, 1);
                break;
            }
            case 'trimestre': {
                const mesInicio = Math.floor(m / 3) * 3;
                inicio = new Date(y, mesInicio, 1);
                let d = 0;
                for (let i = 0; i < 3; i++) {
                    d += new Date(y, mesInicio + i + 1, 0).getDate();
                }
                diasEnMes = d;
                break;
            }
            default: { // 'dia', 'semana', 'anio'
                diasEnMes = new Date(y, m + 1, 0).getDate();
                inicio = new Date(y, m, 1);
                break;
            }
        }

        const diasTranscurridos = Math.max(
            (inicio && !isNaN(inicio))
                ? Math.round((fechaHoy - inicio) / 86400000) + 1
                : 1,
            1
        );

        return {
            diasEnMes,
            diasTranscurridos,
            diasRestantes: Math.max(diasEnMes - diasTranscurridos, 0)
        };
    };

    /**
     * Calcula gastos por categoría desde caja chica.
     *
     * Las categorías se acumulan usando la ETIQUETA LEGIBLE tal como aparece en
     * `m.categoria` (ej: 'Combustible', 'Mano de Obra'). Si un movimiento tiene
     * categoría compuesta con '/' (ej: 'Combustible/Viajes'), se registra bajo la
     * primera categoría únicamente para evitar doble conteo.
     *
     * @param {Array<{tipo:string, categoria:string, monto:number}>} movimientos
     * @returns {Object<string,number>} Mapa categoria → monto acumulado
     */
    const gastosPorCategoria = (movimientos) => {
        /** @type {Object<string,number>} */
        const gastos = {};

        (movimientos || []).forEach(m => {
            if (m.tipo !== 'egreso' || !m.categoria) return;

            const monto = Number(m.monto) || 0;
            if (monto === 0) return;

            // Si la categoría es compuesta (separada por '/'), usar solo la primera
            // parte para evitar doble conteo. Ej: 'Combustible/Viajes' → 'Combustible'.
            const categoriaKey = String(m.categoria).split('/')[0].trim() || 'Otros';

            gastos[categoriaKey] = (gastos[categoriaKey] || 0) + monto;
        });

        return gastos;
    };

    /**
     * Obtiene el rango de fechas según el período.
     * @private
     * @param {string} periodo - 'dia'|'semana'|'mes'|'trimestre'|'anio'
     * @param {Date} fechaHoy
     * @returns {{inicio:Date, fin:Date}}
     */
    const _obtenerRangoPeriodo = (periodo, fechaHoy) => {
        const y = fechaHoy.getFullYear();
        const m = fechaHoy.getMonth();
        const d = fechaHoy.getDate();
        let inicio;
        let fin;

        switch (periodo) {
            case 'dia': {
                inicio = new Date(y, m, d);
                fin = new Date(y, m, d);
                break;
            }
            case 'semana': {
                const diaSemana = fechaHoy.getDay();
                inicio = new Date(y, m, d - diaSemana);
                fin = new Date(y, m, d + (6 - diaSemana));
                break;
            }
            case 'mes': {
                inicio = new Date(y, m, 1);
                fin = new Date(y, m + 1, 0);
                break;
            }
            case 'trimestre': {
                const trimestreInicio = Math.floor(m / 3) * 3;
                inicio = new Date(y, trimestreInicio, 1);
                fin = new Date(y, trimestreInicio + 3, 0);
                break;
            }
            case 'anio': {
                inicio = new Date(y, 0, 1);
                fin = new Date(y, 11, 31);
                break;
            }
            default: {
                inicio = new Date(y, m, 1);
                fin = new Date(y, m + 1, 0);
                break;
            }
        }

        return { inicio, fin };
    };

    /**
     * Filtra registros por rango de fechas.
     * @private
     * @param {Array} registros
     * @param {string} campoFecha
     * @param {Date} inicio
     * @param {Date} fin
     * @returns {Array}
     */
    const _filtrarPorRango = (registros, campoFecha, inicio, fin) => {
        return (registros || []).filter(r => {
            const fecha = new Date(r[campoFecha]);
            return fecha >= inicio && fecha <= fin;
        });
    };

    /**
     * Calcula todos los KPIs del dashboard de resumen.
     * Coherente con cargarResumen y actualizarDashboard (index.html).
     *
     * @param {Object} datos - Salida de getProyectoData()
     * @param {{presupuestoInicial:number}} config
     * @param {string} [periodo='mes']
     * @returns {KPIs}
     */
    const calcularKPIs = (datos, config, periodo = 'mes') => {
        const db = datos || {};
        const fechaHoy = new Date();
        const { diasEnMes, diasTranscurridos, diasRestantes } = _ventanaPeriodo(periodo, fechaHoy);
        const { inicio: periodoInicio, fin: periodoFin } = _obtenerRangoPeriodo(periodo, fechaHoy);

        // ── Caja chica ────────────────────────────────────────────────────────
        const caja = db.caja_chica || [];
        const totalIngresos = sumaTipo(caja, 'ingreso');
        const totalEgresos = sumaTipo(caja, 'egreso');

        const presupuesto = (config && Number(config.presupuestoInicial)) || 0;
        const saldo = presupuesto + totalIngresos - totalEgresos;

        // ── Viajes ───────────────────────────────────────────────────────────
        const viajes = (db.viajes_camiones && db.viajes_camiones.viajes) || [];
        const camiones = (db.viajes_camiones && db.viajes_camiones.camiones) || [];
        let viajesPropios = 0;
        let viajesAlq = 0;
        let totalKm = 0;
        let totalLitros = 0;

        viajes.forEach(v => {
            totalKm += (v.km_total || 0);
            totalLitros += (v.litros || 0);
            // La propiedad puede estar en el viaje (datos nuevos) o hay que buscarla
            // en el catálogo de camiones (datos migrados de versiones anteriores).
            const prop = v.propiedad
                || ((camiones.find(c => c.id === v.vehiculo_id) || {}).propiedad)
                || 'propio';
            if (prop === 'alquilado') { viajesAlq += 1; } else { viajesPropios += 1; }
        });

        // ── Mantenimiento e insumos ──────────────────────────────────────────
        const ordenes = (db.mantenimiento && db.mantenimiento.ordenes) || [];
        const insumos = (db.mantenimiento && db.mantenimiento.compras_insumos) || [];
        const totalMantenimiento = ordenes.reduce((s, o) => s + (Number(o.costo) || 0), 0)
            + insumos.reduce((s, i) => s + (Number(i.costo) || 0), 0);

        // ── Nómina ───────────────────────────────────────────────────────────
        const asist = (db.personal && db.personal.asistencia) || [];
        const regsAsist = asist.flatMap(dia =>
            (dia.registros || []).map(r => ({ ...r, fecha: dia.fecha }))
        );
        const totalNomina = regsAsist.reduce(
            (s, r) => s + ((r.calculos && r.calculos.total_diario) || 0), 0
        );

        // ── Gastos del período para proyección y análisis ────────────────────
        const movimientosPeriodo = _filtrarPorRango(caja, 'fecha', periodoInicio, periodoFin)
            .filter(m => m.tipo === 'egreso');
        const gastoPeriodo = movimientosPeriodo.reduce((s, m) => s + (Number(m.monto) || 0), 0);
        const gastoDiarioPromedio = diasTranscurridos > 0 ? gastoPeriodo / diasTranscurridos : 0;
        const proyeccionFinDeMes = gastoPeriodo + (gastoDiarioPromedio * diasRestantes);

        const tendencia = gastoDiarioPromedio > 0
            ? (proyeccionFinDeMes > presupuesto ? 'excedera' : 'dentro')
            : 'sin_datos';

        // ── Variación vs período anterior ────────────────────────────────────
        let variacionPeriodo = 0;
        if (periodo === 'mes') {
            const mesAnt = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth() - 1, 1);
            const mesAntFin = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), 0);
            const gastosPeriodoAnt = _filtrarPorRango(caja, 'fecha', mesAnt, mesAntFin)
                .filter(m => m.tipo === 'egreso')
                .reduce((s, m) => s + (Number(m.monto) || 0), 0);
            variacionPeriodo = gastosPeriodoAnt > 0
                ? ((gastoPeriodo - gastosPeriodoAnt) / gastosPeriodoAnt) * 100
                : 0;
        }

        // ── Eficiencia con datos del período ─────────────────────────────────
        const viajesPeriodo = _filtrarPorRango(viajes, 'fecha', periodoInicio, periodoFin);
        const kmPeriodo = viajesPeriodo.reduce((s, v) => s + (v.km_total || 0), 0);
        const litrosPeriodo = viajesPeriodo.reduce((s, v) => s + (v.litros || 0), 0);

        const maquinariaRegistros = (db.maquinaria_flota && db.maquinaria_flota.registros) || [];
        const totalHorasMaq = maquinariaRegistros.reduce((s, r) => s + (r.horas || 0), 0);

        const gastoMaqPeriodo = movimientosPeriodo
            .filter(m => m.categoria && m.categoria.toLowerCase().includes('maquinaria'))
            .reduce((s, m) => s + (Number(m.monto) || 0), 0);

        const costoHoraMaquinaria = totalHorasMaq > 0 ? gastoMaqPeriodo / totalHorasMaq : 0;
        const eficienciaCombustible = kmPeriodo > 0 ? litrosPeriodo / kmPeriodo : 0;
        const costoPorM3 = viajesPeriodo.length > 0
            ? gastoPeriodo / (viajesPeriodo.length * 12)
            : 0;

        // ── Gastos por categoría del período ─────────────────────────────────
        // gastosPorCategoria recibe los movimientos del período ya filtrados.
        // Las claves del resultado son etiquetas legibles (tal como se almacenan
        // en caja_chica[].categoria), NO claves snake_case internas.
        const gastosPorCategoriaPeriodo = gastosPorCategoria(movimientosPeriodo);

        return {
            presupuesto,
            totalIngresos,
            totalEgresos,
            saldo,
            movimientosIngreso: cuentaTipo(caja, 'ingreso'),
            movimientosEgreso: cuentaTipo(caja, 'egreso'),
            totalViajes: viajes.length,
            viajesPropios,
            viajesAlquilados: viajesAlq,
            totalKm,
            totalLitros,
            totalMantenimiento,
            totalNomina,
            gastoDiarioPromedio,
            proyeccionFinDeMes,
            diasRestantes,
            tendencia,
            variacionMensual: variacionPeriodo,
            costoPorM3,
            costoHoraMaquinaria,
            eficienciaCombustible,
            gastosPorCategoria: gastosPorCategoriaPeriodo,
            gastoPeriodo,
            periodoInicio,
            periodoFin
        };
    };

    /**
     * API pública del módulo.
     * @type {Readonly<object>}
     */
    const api = Object.freeze({
        calcularKPIs,
        gastosPorCategoria,
        sumaTipo,
        cuentaTipo
    });

    // ── Exposición en navegador: un único global congelado y no enumerable ──
    if (globalScope) {
        try {
            Object.defineProperty(globalScope, 'CR_KPIEngine', {
                value: api,
                writable: false,
                enumerable: false,
                configurable: false
            });
        } catch (e) {
            // Entornos restringidos: la definición falla pero el módulo sigue vivo.
        }
    }

    // ── Exposición CommonJS para testing / SSR ──────────────────────────────
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

})(typeof window !== 'undefined' ? window : globalThis);

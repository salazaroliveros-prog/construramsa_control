/**
 * CONSTRURAMSA v2.9.0 — Test Unitario de Módulos src/
 * Cubre la configuración centralizada (CR_CONFIG), el módulo de exportación
 * (CR_Export), el motor de KPIs (CR_KPIEngine) y el reporte ejecutivo
 * (CR_ReporteEjecutivo): moneda, paleta, firmas, sanitización CSV anti-inyección,
 * serialización y cálculos de KPIs. Es 100% Node (sin navegador), puro e idempotente.
 */
'use strict';

const cfg = require('./src/config.js');
const exp = require('./src/exportador.js');
const kpi = require('./src/kpiEngine.js');
const rep = require('./src/reporteEjecutivo.js');

let pass = 0, fail = 0;
const check = (name, cond) => {
  console.log((cond ? '✅' : '❌') + ' ' + name);
  cond ? pass++ : fail++;
};

/* ── Configuración centralizada ───────────────────────────────────── */
check('cfg.version = 2.9.1', cfg.APP_VERSION === '2.9.1');
check('cfg.moneda = Q', cfg.APP_CONFIG.moneda === 'Q');
check('cfg.APP_CONFIG congelado', Object.isFrozen(cfg.APP_CONFIG));
check('cfg.dbKey', cfg.APP_CONFIG.dbKey === 'construramsa_db');
check('cfg.paleta.primario', cfg.PALETA_CORPORATIVA.primario === '#004B93');
check('cfg.paleta sec/oscuro coherentes con --pdf-*', 
  cfg.PALETA_CORPORATIVA.secundario === '#00A4E4' &&
  cfg.PALETA_CORPORATIVA.grisOscuro === '#374151');
check('cfg.firmas = 2', cfg.PLANTILLA_CORPORATIVA.firmasAutorizadas.length === 2);
check('cfg.EXPORT_CONFIG.csvFormulaGuard', cfg.EXPORT_CONFIG.csvFormulaGuard === true);
check('cfg.EXPORT_CONFIG.maxRows', cfg.EXPORT_CONFIG.maxRowsPerPage === 40);

/* ── Exportador: sanitización CSV ─────────────────────────────────── */
const muestras = [null, undefined, 0, '', 'Block 10', '=1+1', '+SUM(A1)', '@cmd', '-x', 'a"b"c', 'Mi\nTexto', '  =esp'];
const fallbackCell = v => { const t = String(v ?? '').replace(/\r?\n/g, ' '); const s = /^[=+\-@]/.test(t.trim()) ? "'" + t : t; return '"' + s.replace(/"/g, '""') + '"'; };
check('celdaCSV idempotente con fallback original', muestras.every(m => exp.celdaCSV(m) === fallbackCell(m)));
check('escaparCampoCSV neutraliza fórmulas', 
  exp.escaparCampoCSV('=1+1') === "'=1+1" && exp.escaparCampoCSV('@cmd') === "'@cmd");
check('construirCSV incluye BOM',
  exp.construirCSV(['a'], [[1]]).charCodeAt(0) === 0xFEFF);

/* ── Exportador: sumas tipadas ────────────────────────────────────── */
const movs = [
  { monto: 100, tipo: 'ingreso' }, { monto: 40, tipo: 'egreso' },
  { monto: 60, tipo: 'ingreso' }, { monto: 'x', tipo: 'ingreso' }, { monto: -5 }
];
check('sumarPorTipo ingreso', exp.sumarPorTipo(movs, 'ingreso') === 160);
check('sumarPorTipo egreso', exp.sumarPorTipo(movs, 'egreso') === 40);
check('sumarPorTipo(undefined)', exp.sumarPorTipo(undefined, 'ingreso') === 0);

/* ── Exportador: montos y nombres ─────────────────────────────────── */
check('formatearMonto 1234.5', exp.formatearMonto(1234.5) === '1,234.50');
check('formatearMonto NaN', exp.formatearMonto(NaN) === '0.00');
check('nombreArchivoSeguro', exp.nombreArchivoSeguro('Reporte $/Obra 2026') === 'Reporte_Obra_2026');

/* ── Motor de KPIs ────────────────────────────────────────────── */
const datosKPI = {
  caja_chica: [
    { id: '1', tipo: 'ingreso', monto: 5000, fecha: new Date().toISOString().slice(0, 10), categoria: 'apertura' },
    { id: '2', tipo: 'egreso',  monto: 1200, fecha: new Date().toISOString().slice(0, 10), categoria: 'materiales' },
    { id: '3', tipo: 'egreso',  monto:  800, fecha: new Date().toISOString().slice(0, 10), categoria: 'salarios' }
  ],
  viajes_camiones: { viajes: [] },
  mantenimiento: { ordenes: [], compras_insumos: [] },
  personal: { asistencia: [] },
  maquinaria_flota: { registros: [] }
};
const kpis = kpi.calcularKPIs(datosKPI, { presupuestoInicial: 10000 }, 'mes');
check('kpi.calcularKPIs devuelve objeto', kpis && typeof kpis === 'object');
check('kpi.totalIngresos = 5000', kpis.totalIngresos === 5000);
check('kpi.totalEgresos = 2000', kpis.totalEgresos === 2000);
check('kpi.saldo = 13000 (presupuesto + ingresos - egresos)', kpis.saldo === 13000);
// gastosPorCategoria se prueba directamente (calcularKPIs filtra por período)
const catsDirect = kpi.gastosPorCategoria(datosKPI.caja_chica);
check('kpi.gastosPorCategoria.materiales = 1200', catsDirect.materiales === 1200);
check('kpi.gastosPorCategoria.salarios = 800', catsDirect.salarios === 800);
check('kpi.sumaTipo ingreso', kpi.sumaTipo(datosKPI.caja_chica, 'ingreso') === 5000);
check('kpi.sumaTipo egreso', kpi.sumaTipo(datosKPI.caja_chica, 'egreso') === 2000);
check('kpi.cuentaTipo ingreso', kpi.cuentaTipo(datosKPI.caja_chica, 'ingreso') === 1);
check('kpi.gastosPorCategoria array vacío', Object.values(kpi.gastosPorCategoria([])).every(v => v === 0));

/* ── Reporte Ejecutivo ─────────────────────────────────────────── */
const kpisRep = rep.calcularKPIs(datosKPI, {});
check('rep.calcularKPIs devuelve objeto', kpisRep && typeof kpisRep === 'object');
check('rep.calcularKPIs.totalGastos = 2000', kpisRep.totalGastos === 2000);
check('rep.calcularKPIs.totalIngresos = 5000', kpisRep.totalIngresos === 5000);
check('rep.calcularKPIs.alertas es array', Array.isArray(kpisRep.alertas));
check('rep.calcularKPIs.alertas no vacío', kpisRep.alertas.length > 0);
const html = rep.generarHTML(datosKPI, { empresa: 'TEST SA' }, { tipo: 'diario', inicio: new Date().toISOString().slice(0, 10), fin: new Date().toISOString().slice(0, 10) });
check('rep.generarHTML devuelve string HTML', typeof html === 'string' && html.includes('<style>'));
check('rep.generarHTML incluye nombre empresa', html.includes('TEST SA'));
check('rep.svgBarrasCategorias sin datos', rep.svgBarrasCategorias({}).includes('Sin datos'));
check('rep.svgTendencia sin datos', rep.svgTendencia({}).includes('Sin tendencia'));
check('rep.COLORES.primario definido', typeof rep.COLORES.primario === 'string' && rep.COLORES.primario.startsWith('#'));

console.log(`\nResultado: ${pass} OK, ${fail} FALLAS`);
process.exit(fail ? 1 : 0);
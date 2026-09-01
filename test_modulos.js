/**
 * CONSTRURAMSA v2.8.5 — Test Unitario de Módulos src/
 * Cubre la configuración centralizada (CR_CONFIG) y el módulo de exportación
 * (CR_Export): moneda, paleta, firmas, sanitización CSV anti-inyección y
 * serialización. Es 100% Node (sin navegador), puro e idempotente.
 */
'use strict';

const cfg = require('./src/config.js');
const exp = require('./src/exportador.js');

let pass = 0, fail = 0;
const check = (name, cond) => {
  console.log((cond ? '✅' : '❌') + ' ' + name);
  cond ? pass++ : fail++;
};

/* ── Configuración centralizada ───────────────────────────────────── */
check('cfg.version = 2.8.6', cfg.APP_VERSION === '2.8.6');
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

console.log(`\nResultado: ${pass} OK, ${fail} FALLAS`);
process.exit(fail ? 1 : 0);
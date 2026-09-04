const assert = require('assert');
const adapter = require('./src/reportDataAdapter.js');

const db = {
  configuracion: { proyecto_actual: 'p1' },
  proyectos: [{ id: 'p1', nombre: 'Proyecto QA' }],
  proyectos_data: {
    p1: {
      caja_chica: [{ id: 'm1', tipo: 'egreso', concepto: 'Cemento', monto: '125.50', fecha: '2026-09-04' }],
      personal: {
        trabajadores: [{ id: 't1', nombre: 'Ana', cargo: 'Operadora', salario_diario: 25, pago_hora_extra: 35 }],
        asistencia: [{ fecha: '2026-09-04', registros: [{ trabajador_id: 't1', estado: 'asistio', horas_extra: '2' }] }]
      },
      adquisiciones: { cotizaciones: [{ id: 'q1', concepto: 'Arena', monto: '80', fecha: '2026-09-04' }] },
      viajes_camiones: { rutas: [], camiones: [], equipo_alquilado: [], viajes: [{ id: 'v1', fecha: '2026-09-04', distancia: '7.5', costo: '300' }] },
      mantenimiento: { maquinaria: [], formatos: {}, ordenes: [{ id: 'o1', fecha: '2026-09-04', maquina_id: 'maq1', costo: '50' }], insumos: [{ id: 'i1', fecha: '2026-09-04', concepto: 'Aceite', monto: '40' }] }
    }
  }
};

const report = adapter.resolve(db);
assert.strictEqual(report.projectName, 'Proyecto QA');
assert.strictEqual(report.data.caja_chica[0].descripcion, 'Cemento');
assert.strictEqual(report.data.caja_chica[0].monto, 125.5);
assert.strictEqual(report.data.personal.trabajadores[0].puesto, 'Operadora');
assert.strictEqual(report.data.adquisiciones.cotizaciones_compras[0].total, 80);
assert.strictEqual(report.data.viajes_camiones.viajes[0].km_total, 7.5);
assert.strictEqual(report.data.mantenimiento.ordenes[0].maquinaria_id, 'maq1');
assert.strictEqual(report.data.mantenimiento.compras_insumos[0].costo, 40);

const summary = adapter.attendanceSummary(report, { inicio: '2026-09-01', fin: '2026-09-30' });
assert.strictEqual(summary.length, 1);
assert.deepStrictEqual({
  attended: summary[0].attended,
  absent: summary[0].absent,
  overtime: summary[0].overtime,
  total: summary[0].total
}, { attended: 1, absent: 0, overtime: 2, total: 270 });

console.log('Report data adapter tests OK');

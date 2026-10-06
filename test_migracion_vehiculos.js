/**
 * test_migracion_vehiculos.js — Pruebas unitarias de `migrarCatalogoVehiculos`.
 * ============================================================================
 * La app tiene UN modelo canónico de unidades: `viajes_camiones.camiones[]`,
 * discriminado por `propiedad` ('propio' | 'alquilado'). `equipo_alquilado` fue
 * un array paralelo obsoleto que la app nunca escribía ni mostraba, así que el
 * equipo alquilado no aparecía en el <select> de viajes, no se podía editar ni
 * eliminar, y cada reporte lo resolvía como 'N/A'.
 *
 * Estas pruebas fijan el comportamiento de la migración: pliega el catálogo
 * legacy, mapea `tarifa_diaria` → `tarifa`, es idempotente, no duplica IDs ni
 * pisa unidades existentes, y conserva los viajes.
 *
 * La función se EXTRAE del <script> inline de index.html para probar exactamente
 * el código de producción, no una copia.
 *
 * Uso: node test_migracion_vehiculos.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Extrae la función real de index.html y la devuelve como callable.
 *
 * Se cuenta el balance de llaves en vez de buscar un delimitador fijo: el
 * archivo usa finales de línea CRLF y la indentación puede cambiar, así que un
 * ancla por texto sería frágil.
 */
function cargarMigracion() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const inicio = html.indexOf('function migrarCatalogoVehiculos(vc)');
  if (inicio < 0) throw new Error('No se encontró migrarCatalogoVehiculos en index.html');

  const abre = html.indexOf('{', inicio);
  let nivel = 0;
  let fin = -1;
  for (let i = abre; i < html.length; i++) {
    const ch = html[i];
    if (ch === '{') nivel++;
    else if (ch === '}') {
      nivel--;
      if (nivel === 0) {
        fin = i + 1;
        break;
      }
    }
  }
  if (fin < 0) throw new Error('No se pudo delimitar migrarCatalogoVehiculos');

  const cuerpo = html.slice(inicio, fin);
  // eslint-disable-next-line no-new-func
  return new Function(`${cuerpo}; return migrarCatalogoVehiculos;`)();
}

let passed = 0;
let failed = 0;
const t = (nombre, fn) => {
  try {
    fn();
    passed++;
    console.log(`✅ ${nombre}`);
  } catch (e) {
    failed++;
    console.log(`❌ ${nombre}: ${e.message}`);
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg || 'condición falsa');
};
const eq = (a, b, msg) => {
  if (a !== b) {
    throw new Error(`${msg || ''} esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
  }
};

const nuevoVC = () => ({
  rutas_botadero: [],
  camiones: [{ id: 'c1', nombre: 'Volvo FH16', capacidad: 25, propiedad: 'propio', consumo: 0.38 }],
  equipo_alquilado: [{ id: 'ea1', nombre: 'Camión Alquilado 1', tarifa_diaria: 800 }],
  viajes: [{ id: 'v1', fecha: '2026-08-31', vehiculo_id: 'ea1', numero: 1, total: 800 }],
});

const MIGRAR = cargarMigracion();
t('Plega equipo_alquilado dentro de camiones', () => {
  const vc = nuevoVC();
  MIGRAR(vc);
  eq(vc.camiones.length, 2, 'camiones debería crecer:');
  eq(vc.camiones[1].id, 'ea1');
  eq(vc.camiones[1].nombre, 'Camión Alquilado 1');
});

t('Mapea el esquema legacy al canónico', () => {
  const vc = nuevoVC();
  MIGRAR(vc);
  const e = vc.camiones.find((c) => c.id === 'ea1');
  eq(e.propiedad, 'alquilado', 'propiedad:');
  eq(e.tarifa, 800, 'tarifa (venía en tarifa_diaria):');
  eq(e.modalidad, 'dia', 'modalidad:');
  eq(e.consumo, 0, 'consumo:');
  eq(e.capacidad, 25, 'capacidad por defecto:');
  assert(e.tarifa_diaria === undefined, 'tarifa_diaria debe eliminarse');
});

t('Deja equipo_alquilado vacío pero presente', () => {
  const vc = nuevoVC();
  MIGRAR(vc);
  assert(Array.isArray(vc.equipo_alquilado), 'la clave debe seguir existiendo');
  eq(vc.equipo_alquilado.length, 0, 'equipo_alquilado:');
});

t('Es idempotente: aplicarla dos veces no cambia nada', () => {
  const vc = nuevoVC();
  MIGRAR(vc);
  const snapshot = JSON.stringify(vc);
  const cambio = MIGRAR(vc);
  eq(cambio, false, 'la segunda pasada debe reportar sin cambios:');
  eq(JSON.stringify(vc), snapshot, 'el objeto cambió en la segunda pasada:');
});

t('No duplica IDs tras varias pasadas', () => {
  const vc = nuevoVC();
  MIGRAR(vc);
  MIGRAR(vc);
  MIGRAR(vc);
  eq(new Set(vc.camiones.map((c) => c.id)).size, vc.camiones.length, 'IDs duplicados:');
});

t('No pisa una unidad que ya existe en el catálogo canónico', () => {
  const vc = nuevoVC();
  vc.camiones.push({
    id: 'ea1',
    nombre: 'Equipo Alquilado Real',
    propiedad: 'alquilado',
    tarifa: 5000,
    modalidad: 'viaje',
    consumo: 0,
    capacidad: 30,
  });
  MIGRAR(vc);
  const e = vc.camiones.find((c) => c.id === 'ea1');
  eq(vc.camiones.length, 2, 'no debe añadir un duplicado:');
  eq(e.tarifa, 5000, 'debe conservar la tarifa del canónico:');
  eq(e.modalidad, 'viaje', 'debe conservar la modalidad del canónico:');
});

t('Conserva los viajes y su referencia por vehiculo_id', () => {
  const vc = nuevoVC();
  MIGRAR(vc);
  eq(vc.viajes.length, 1, 'viajes:');
  eq(vc.viajes[0].vehiculo_id, 'ea1', 'vehiculo_id:');
  assert(
    vc.camiones.some((c) => c.id === vc.viajes[0].vehiculo_id),
    'el viaje debe seguir apuntando a una unidad existente'
  );
});

t('Completa campos faltantes en unidades propias', () => {
  const vc = { camiones: [{ id: 'x1', nombre: 'Legacy' }], equipo_alquilado: [], viajes: [] };
  MIGRAR(vc);
  eq(vc.camiones[0].propiedad, 'propio', 'propiedad por defecto:');
  eq(vc.camiones[0].capacidad, 25, 'capacidad por defecto:');
  eq(vc.camiones[0].consumo, 0.35, 'consumo por defecto (no debe ser undefined):');
  assert(Number.isFinite(vc.camiones[0].consumo), 'consumo debe ser numérico');
});

t('Preserva un consumo intencionalmente 0 en un camión propio', () => {
  // Un 0 explícito es un dato legítimo; rellenarlo con 0.35 falsearía el costo.
  const vc = { camiones: [{ id: 'x0', nombre: 'Eléctrico', propiedad: 'propio', consumo: 0 }] };
  MIGRAR(vc);
  eq(vc.camiones[0].consumo, 0, 'el 0 debe conservarse:');
});

t('Un camión propio sin consumo no produce costo de combustible Q0 en silencio', () => {
  // Reproduce el cálculo real de index.html:10575: litros = kmTotal * parseFloat(consumo).
  // Sin backfill, parseFloat(undefined) → NaN → `|| 0` → litros 0 → Q0 de combustible.
  const vc = {
    camiones: [{ id: 'p1', nombre: 'Mack', propiedad: 'propio' }],
    equipo_alquilado: [],
    viajes: [],
  };
  MIGRAR(vc);
  const cam = vc.camiones[0];
  const kmTotal = 100;
  const litros = kmTotal * (parseFloat(cam.consumo) || 0);
  assert(litros > 0, `litros no debe ser 0: kmTotal(${kmTotal}) * consumo(${cam.consumo})`);
});

t('Tolera datos corruptos sin lanzar', () => {
  MIGRAR(null);
  MIGRAR(undefined);
  MIGRAR({});
  MIGRAR({ camiones: null, equipo_alquilado: null });
  const vc = {
    camiones: [{ id: null }, null, { nombre: 'sin id' }],
    equipo_alquilado: [null, { nombre: 'sin id' }],
  };
  MIGRAR(vc);
  assert(Array.isArray(vc.camiones), 'camiones debe quedar como array');
});

t('Una tarifa_diaria inválida no produce NaN', () => {
  const vc = {
    camiones: [],
    equipo_alquilado: [{ id: 'eaX', nombre: 'Roto', tarifa_diaria: 'no-es-numero' }],
    viajes: [],
  };
  MIGRAR(vc);
  const e = vc.camiones.find((c) => c.id === 'eaX');
  assert(Number.isFinite(e.tarifa), 'tarifa no puede ser NaN');
  eq(e.tarifa, 0, 'tarifa debe caer a 0:');
});

console.log('\n' + '='.repeat(56));
console.log(`RESULTADO: ${passed} passed, ${failed} failed`);
console.log('='.repeat(56));

process.exit(failed > 0 ? 1 : 0);

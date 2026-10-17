/**
 * @fileoverview Validador de sincronización en la nube para CONSTRURAMSA.
 *
 * Ejecuta pruebas contra los módulos de sincronización (syncManager) usando
 * la DB real del backup para detectar:
 *  - Registros duplicados en módulos rastreados
 *  - Errores de integridad estructural
 *  - Correcto funcionamiento de cleanDuplicates y validateIntegrity
 *
 * @module syncValidator
 */

const fs = require('fs');
const path = require('path');

const BACKUP_FILE = 'control_obra_backup_2026-10-17 (1).json';
const syncManager = require('./src/syncManager.js');

console.log('═════════════════════════════════════════════════════════════════════');
console.log('  VALIDADOR DE SINCRONIZACIÓN EN LA NUBE — CONSTRURAMSA');
console.log('═════════════════════════════════════════════════════════════════════');
console.log('');

// Cargar DB real del backup
const dbPath = path.join(__dirname, BACKUP_FILE);
if (!fs.existsSync(dbPath)) {
  console.error(`❌ No se encontró el archivo de backup: ${BACKUP_FILE}`);
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
console.log(`📊 DB cargada: ${BACKUP_FILE}`);
console.log(`   Proyecto actual: ${db.configuracion.proyecto_actual}`);
console.log(`   Proveedor nube: ${db.configuracion.nube?.proveedor || 'N/A'}`);
console.log(`   OneDrive conectado: ${db.configuracion.nube?.od_connected || false}`);
console.log('');

let totalIssues = 0;

// ═════════════════════════════════════════════════════════════════════
// 1. VALIDACIÓN DE INTEGRIDAD ESTRUCTURAL
// ═════════════════════════════════════════════════════════════════════
console.log('─── 1. VALIDACIÓN DE INTEGRIDAD ESTRUCTURAL ───');
const integrity = syncManager.validateIntegrity(db);
if (integrity.valid) {
  console.log('   ✅ DB pasa validación de integridad estructural');
} else {
  totalIssues += integrity.errors.length;
  console.log('   ❌ Errores de integridad:');
  integrity.errors.forEach((e) => console.log(`      - ${e}`));
}
console.log('');

// ═════════════════════════════════════════════════════════════════════
// 2. DETECCIÓN DE DUPLICADOS POR MÓDULO
// ═════════════════════════════════════════════════════════════════════
console.log('─── 2. DETECCIÓN DE DUPLICADOS POR MÓDULO ───');

const modulosRastreados = [
  'caja_chica',
  'maquinaria_flota.vehiculos',
  'maquinaria_flota.registros',
  'personal.trabajadores',
  'personal.asistencia',
  'adquisiciones.proveedores',
  'adquisiciones.cotizaciones_compras',
  'viajes_camiones.rutas_botadero',
  'viajes_camiones.camiones',
  'viajes_camiones.equipo_alquilado',
  'viajes_camiones.viajes',
  'mantenimiento.maquinaria',
  'mantenimiento.ordenes',
  'mantenimiento.compras_insumos',
  'proyectos',
];

function getNested(obj, path) {
  return path
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

let totalDuplicados = 0;
for (const mod of modulosRastreados) {
  const arr = getNested(db, mod);
  if (Array.isArray(arr) && arr.length > 0) {
    const { duplicates, unique } = syncManager.detectDuplicates(arr);
    if (duplicates.length > 0) {
      totalDuplicados += duplicates.length;
      totalIssues += duplicates.length;
      console.log(`   ⚠️  ${mod}: ${duplicates.length} registro(s) duplicado(s)`);
      duplicates.slice(0, 3).forEach((d) => {
        console.log(`         - id: ${d.id || 'sin_id'}, clave: ${JSON.stringify(d).slice(0, 80)}`);
      });
      if (duplicates.length > 3) {
        console.log(`         ... y ${duplicates.length - 3} más`);
      }
    } else {
      console.log(`   ✅ ${mod}: ${arr.length} registro(s), sin duplicados`);
    }
  } else if (arr !== undefined) {
    console.log(`   ℹ️  ${mod}: no es un array o está vacío`);
  }
}
console.log(`   Total duplicados detectados: ${totalDuplicados}`);
console.log('');

// ═════════════════════════════════════════════════════════════════════
// 3. LIMPIEZA DE DUPLICADOS
// ═════════════════════════════════════════════════════════════════════
console.log('─── 3. LIMPIEZA DE DUPLICADOS (cleanDuplicates) ───');
const { db: dbLimpia, report } = syncManager.cleanDuplicates(cloneDeep(db));
if (report.cleaned) {
  console.log('   ✅ Duplicados eliminados:');
  for (const [mod, count] of Object.entries(report.removedByModule)) {
    console.log(`      - ${mod}: ${count} eliminado(s)`);
  }
} else {
  console.log('   ✅ No se encontraron duplicados para limpiar');
}
console.log('');

// ═════════════════════════════════════════════════════════════════════
// 4. VALIDACIÓN DESPUÉS DE LIMPIEZA
// ═════════════════════════════════════════════════════════════════════
console.log('─── 4. VALIDACIÓN DESPUÉS DE LIMPIEZA ───');
const integrityLimpia = syncManager.validateIntegrity(dbLimpia);
if (integrityLimpia.valid) {
  console.log('   ✅ DB limpia pasa validación de integridad');
} else {
  totalIssues += integrityLimpia.errors.length;
  console.log('   ❌ Errores después de limpieza:');
  integrityLimpia.errors.forEach((e) => console.log(`      - ${e}`));
}
console.log('');

// ═════════════════════════════════════════════════════════════════════
// 5. ESTADO DE SINCRONIZACIÓN
// ═════════════════════════════════════════════════════════════════════
console.log('─── 5. ESTADO DE SINCRONIZACIÓN (CR_SyncManager) ───');
const status = syncManager.getStatus();
console.log(`   Sincronizando: ${status.isSyncing ? 'SÍ' : 'NO'}`);
console.log(`   Pendientes en cola: ${status.pendingCount}`);
console.log(`   Último sync: ${status.lastSyncTs || 'nunca'}`);
console.log(`   Conectado a nube: ${status.connected ? 'SÍ' : 'NO'}`);
console.log('');

// ═════════════════════════════════════════════════════════════════════
// RESUMEN
// ═════════════════════════════════════════════════════════════════════
console.log('═════════════════════════════════════════════════════════════════════');
console.log('  RESUMEN DE VALIDACIÓN DE SINCRONIZACIÓN');
console.log('═════════════════════════════════════════════════════════════════════');
console.log(`   Problemas totales: ${totalIssues}`);
console.log(`   Duplicados encontrados: ${totalDuplicados}`);
if (totalIssues === 0) {
  console.log('   ✅ Todo correcto: no hay duplicados ni errores de integridad');
} else {
  console.log(`   ⚠️  Se encontraron ${totalIssues} problema(s) que requieren atención`);
}
console.log('═════════════════════════════════════════════════════════════════════');

function cloneDeep(v) {
  return JSON.parse(JSON.stringify(v));
}

// Código de salida basado en problemas encontrados
process.exit(totalIssues > 0 ? 1 : 0);

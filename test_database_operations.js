/**
 * Test de Operaciones de Base de Datos - CONSTRURAMSA Control de Obra v2.9.4
 * ========================================================================
 * Valida CRUD completo: Crear, Leer, Actualizar, Eliminar
 *
 * Ejecución: node test_database_operations.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./test_sandbox');

// La suite hace CRUD real, así que escribe en una COPIA temporal de la
// semilla en vez del archivo versionado (ver test_sandbox.js). Antes escribía
// sobre `construramsa_db.json` y dependía de un restoreDB() al final: una
// interrupción dejaba la semilla reemplazada por el fixture.
const sandbox = createSandbox('db-ops');
const DB_FILE = sandbox.dbPath;
const BACKUP_FILE = DB_FILE + '.backup';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️ ${message}`, 'cyan');
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    logSuccess(message);
  } else {
    failed++;
    logError(message);
  }
}

// Backup original DB
function backupDB() {
  if (fs.existsSync(DB_FILE)) {
    fs.copyFileSync(DB_FILE, BACKUP_FILE);
    logInfo('Backup de DB creado');
  }
}

// Restaurar la base de datos dentro del sandbox (la semilla del repo nunca se toca).
function restoreDB() {
  if (fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(BACKUP_FILE, DB_FILE);
    fs.unlinkSync(BACKUP_FILE);
    logInfo('DB restaurada del backup');
  }
}

// Eliminar el sandbox. Se invoca siempre: el `finally` cubre tanto el éxito
// como cualquier excepción, de modo que no quedan archivos temporales.
function cleanupSandbox() {
  restoreDB();
  sandbox.cleanup();
}

// DB inicial vacía
const emptyDB = {
  version: '2.9.4',
  configuracion: {
    nombre_empresa: 'CONSTRURAMSA',
    eslogan: 'SOLUCIONES EN INGENIERÍA Y ARQUITECTURA',
    logo_base64: '',
    presupuesto_inicial_caja: 0,
    proyecto_actual: null,
  },
  proyectos: [],
  proyectos_data: {},
  reportes: [],
};

// Guardar DB — escritura atómica (temp + rename). El temp termina en `.tmp`
// (patrón ya ignorado por git) para que una interrupción no ensucie el repo.
// En Windows el rename puede fallar con EPERM si otro proceso tiene el destino
// abierto leyéndolo: en ese caso se escribe directo y se limpia el temp.
function saveDB(db) {
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  const data = JSON.stringify(db, null, 2);
  fs.writeFileSync(tmp, data);
  try {
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    fs.writeFileSync(DB_FILE, data);
    try {
      fs.unlinkSync(tmp);
    } catch (e) {
      /* temp ya ausente */
    }
  }
}

// Leer DB
function loadDB() {
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(raw);
}

// Test 1: Crear DB inicial
function testCreateInitialDB() {
  logInfo('\n--- Test 1: Crear DB inicial ---');
  saveDB(emptyDB);
  const db = loadDB();
  assert(db.version === '2.9.4', 'Versión de DB correcta');
  assert(db.configuracion.nombre_empresa === 'CONSTRURAMSA', 'Nombre de empresa correcto');
  assert(Array.isArray(db.proyectos), 'Proyectos es un array');
  assert(typeof db.proyectos_data === 'object', 'Proyectos_data es un objeto');
  assert(Array.isArray(db.reportes), 'Reportes es un array');
}

// Test 2: Crear proyecto
function testCreateProject() {
  logInfo('\n--- Test 2: Crear proyecto ---');
  const db = loadDB();
  const project = {
    id: 'proj_test_1',
    nombre: 'Proyecto de Prueba',
    presupuesto: 100000,
    fecha_creacion: '2026-09-30',
    responsable: 'Test User',
    activo: true,
  };
  db.proyectos.push(project);
  db.proyectos_data[project.id] = {
    caja_chica: [],
    maquinaria_flota: { vehiculos: [], registros: [] },
    personal: { trabajadores: [], asistencia: [] },
    adquisiciones: { proveedores: [], cotizaciones_compras: [] },
    viajes_camiones: { rutas_botadero: [], camiones: [], equipo_alquilado: [], viajes: [] },
    mantenimiento: { maquinaria: [], formatos: {}, ordenes: [], compras_insumos: [] },
  };
  db.configuracion.proyecto_actual = project.id;
  saveDB(db);

  const loaded = loadDB();
  assert(loaded.proyectos.length === 1, 'Proyecto creado');
  assert(loaded.proyectos[0].id === 'proj_test_1', 'ID de proyecto correcto');
  assert(loaded.configuracion.proyecto_actual === 'proj_test_1', 'Proyecto actual configurado');
  assert(loaded.proyectos_data['proj_test_1'], 'Datos de proyecto creados');
}

// Test 3: Crear movimiento de caja chica
function testCreateCajaChica() {
  logInfo('\n--- Test 3: Crear movimiento de caja chica ---');
  const db = loadDB();
  const movimiento = {
    id: 'mov_1',
    tipo: 'egreso',
    monto: 150.5,
    descripcion: 'Compra de cemento',
    categoria: 'Materiales',
    fecha: '2026-09-30',
  };
  db.proyectos_data['proj_test_1'].caja_chica.push(movimiento);
  saveDB(db);

  const loaded = loadDB();
  assert(loaded.proyectos_data['proj_test_1'].caja_chica.length === 1, 'Movimiento creado');
  assert(loaded.proyectos_data['proj_test_1'].caja_chica[0].monto === 150.5, 'Monto correcto');
  assert(loaded.proyectos_data['proj_test_1'].caja_chica[0].tipo === 'egreso', 'Tipo correcto');
}

// Test 4: Actualizar movimiento
function testUpdateCajaChica() {
  logInfo('\n--- Test 4: Actualizar movimiento ---');
  const db = loadDB();
  db.proyectos_data['proj_test_1'].caja_chica[0].monto = 200.75;
  db.proyectos_data['proj_test_1'].caja_chica[0].descripcion = 'Compra de cemento actualizada';
  saveDB(db);

  const loaded = loadDB();
  assert(loaded.proyectos_data['proj_test_1'].caja_chica[0].monto === 200.75, 'Monto actualizado');
  assert(
    loaded.proyectos_data['proj_test_1'].caja_chica[0].descripcion ===
      'Compra de cemento actualizada',
    'Descripción actualizada'
  );
}

// Test 5: Eliminar movimiento
function testDeleteCajaChica() {
  logInfo('\n--- Test 5: Eliminar movimiento ---');
  const db = loadDB();
  const initialLength = db.proyectos_data['proj_test_1'].caja_chica.length;
  db.proyectos_data['proj_test_1'].caja_chica = db.proyectos_data['proj_test_1'].caja_chica.filter(
    (m) => m.id !== 'mov_1'
  );
  saveDB(db);

  const loaded = loadDB();
  assert(
    loaded.proyectos_data['proj_test_1'].caja_chica.length === initialLength - 1,
    'Movimiento eliminado'
  );
  assert(
    !loaded.proyectos_data['proj_test_1'].caja_chica.find((m) => m.id === 'mov_1'),
    'Movimiento no existe'
  );
}

// Test 6: Crear trabajador
function testCreateTrabajador() {
  logInfo('\n--- Test 6: Crear trabajador ---');
  const db = loadDB();
  const trabajador = {
    id: 'trab_1',
    nombre: 'Juan Pérez',
    puesto: 'Albañil',
    pago_hora_normal: 25,
    pago_hora_extra: 35,
    activo: true,
  };
  db.proyectos_data['proj_test_1'].personal.trabajadores.push(trabajador);
  saveDB(db);

  const loaded = loadDB();
  assert(
    loaded.proyectos_data['proj_test_1'].personal.trabajadores.length === 1,
    'Trabajador creado'
  );
  assert(
    loaded.proyectos_data['proj_test_1'].personal.trabajadores[0].nombre === 'Juan Pérez',
    'Nombre correcto'
  );
}

// Test 7: Crear registro de asistencia
function testCreateAsistencia() {
  logInfo('\n--- Test 7: Crear registro de asistencia ---');
  const db = loadDB();
  const asistencia = {
    fecha: '2026-09-30',
    registros: [
      {
        trabajador_id: 'trab_1',
        estado: 'asistio',
        horas_extras: 2,
        calculos: { total_diario: 220 },
      },
    ],
  };
  db.proyectos_data['proj_test_1'].personal.asistencia.push(asistencia);
  saveDB(db);

  const loaded = loadDB();
  assert(
    loaded.proyectos_data['proj_test_1'].personal.asistencia.length === 1,
    'Asistencia creada'
  );
  assert(
    loaded.proyectos_data['proj_test_1'].personal.asistencia[0].fecha === '2026-09-30',
    'Fecha correcta'
  );
}

// Test 8: Crear viaje
function testCreateViaje() {
  logInfo('\n--- Test 8: Crear viaje ---');
  const db = loadDB();
  const viaje = {
    id: 'viaje_1',
    tipo: 'propio',
    total: 300,
    fecha: '2026-09-30',
    vehiculo_id: 'camion_1',
    material: 'Arena',
    numero: 1,
    km_total: 15,
    litros: 20,
    costo_combustible: 150,
  };
  db.proyectos_data['proj_test_1'].viajes_camiones.viajes.push(viaje);
  saveDB(db);

  const loaded = loadDB();
  assert(loaded.proyectos_data['proj_test_1'].viajes_camiones.viajes.length === 1, 'Viaje creado');
  assert(
    loaded.proyectos_data['proj_test_1'].viajes_camiones.viajes[0].total === 300,
    'Total correcto'
  );
}

// Test 9: Crear orden de mantenimiento
function testCreateMantenimiento() {
  logInfo('\n--- Test 9: Crear orden de mantenimiento ---');
  const db = loadDB();
  const orden = {
    id: 'mant_1',
    maquinaria_id: 'maq_1',
    tipo: 'preventivo',
    costo: 500,
    observaciones: 'Cambio de aceite',
    fecha: '2026-09-30',
  };
  db.proyectos_data['proj_test_1'].mantenimiento.ordenes.push(orden);
  saveDB(db);

  const loaded = loadDB();
  assert(loaded.proyectos_data['proj_test_1'].mantenimiento.ordenes.length === 1, 'Orden creada');
  assert(
    loaded.proyectos_data['proj_test_1'].mantenimiento.ordenes[0].tipo === 'preventivo',
    'Tipo correcto'
  );
}

// Test 10: Validar integridad de datos
function testDataIntegrity() {
  logInfo('\n--- Test 10: Validar integridad de datos ---');
  const db = loadDB();
  assert(db.version === '2.9.4', 'Versión de DB intacta');
  assert(db.configuracion.proyecto_actual === 'proj_test_1', 'Proyecto actual intacto');
  assert(db.proyectos.length === 1, 'Proyectos intactos');
  assert(
    db.proyectos_data['proj_test_1'].personal.trabajadores.length === 1,
    'Trabajadores intactos'
  );
  assert(db.proyectos_data['proj_test_1'].personal.asistencia.length === 1, 'Asistencia intacta');
  assert(db.proyectos_data['proj_test_1'].viajes_camiones.viajes.length === 1, 'Viajes intactos');
  assert(
    db.proyectos_data['proj_test_1'].mantenimiento.ordenes.length === 1,
    'Mantenimiento intacto'
  );
}

// Test 11: Eliminar proyecto
function testDeleteProject() {
  logInfo('\n--- Test 11: Eliminar proyecto ---');
  const db = loadDB();
  const projectId = 'proj_test_1';
  db.proyectos = db.proyectos.filter((p) => p.id !== projectId);
  delete db.proyectos_data[projectId];
  if (db.configuracion.proyecto_actual === projectId) {
    db.configuracion.proyecto_actual = null;
  }
  saveDB(db);

  const loaded = loadDB();
  assert(loaded.proyectos.length === 0, 'Proyecto eliminado de lista');
  assert(!loaded.proyectos_data['proj_test_1'], 'Datos de proyecto eliminados');
  assert(loaded.configuracion.proyecto_actual === null, 'Proyecto actual reseteado');
}

// Ejecutar todos los tests
let exitCode = 0;
try {
  backupDB();

  testCreateInitialDB();
  testCreateProject();
  testCreateCajaChica();
  testUpdateCajaChica();
  testDeleteCajaChica();
  testCreateTrabajador();
  testCreateAsistencia();
  testCreateViaje();
  testCreateMantenimiento();
  testDataIntegrity();
  testDeleteProject();

  logInfo('\n' + '='.repeat(50));
  logInfo(`RESULTADO: ${passed} passed, ${failed} failed`);
  logInfo('='.repeat(50));

  exitCode = failed > 0 ? 1 : 0;
} catch (error) {
  logError(`Error inesperado: ${error.message}`);
  exitCode = 1;
} finally {
  // El sandbox se destruye pase lo que pase: así una interrupción nunca deja
  // la semilla del repo (ni archivos temporales) en un estado inconsistente.
  cleanupSandbox();
}

process.exit(exitCode);

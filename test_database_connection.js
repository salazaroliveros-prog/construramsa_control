/**
 * Test de Conexión a Base de Datos - CONSTRURAMSA Control de Obra v2.9.4
 * =====================================================================
 * Valida la lógica de conexión, inicialización y manejo de errores de DB
 *
 * Ejecución: node test_database_connection.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createSandbox } = require('./test_sandbox');

// La suite escribe DBs de prueba, así que trabaja sobre una COPIA temporal de
// la semilla en vez del archivo versionado (ver test_sandbox.js).
const sandbox = createSandbox('db-conn');
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

// Restore original DB
function restoreDB() {
  if (fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(BACKUP_FILE, DB_FILE);
    fs.unlinkSync(BACKUP_FILE);
    logInfo('DB restaurada del backup');
  }
}

// DB inicial válida
const validDB = {
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

// Test 1: Inicialización de DB cuando no existe
function testDBInitialization() {
  logInfo('\n--- Test 1: Inicialización de DB ---');
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
  }

  // Simular inicialización
  saveDB(validDB);
  const db = loadDB();

  assert(fs.existsSync(DB_FILE), 'Archivo DB creado');
  assert(db.version === '2.9.4', 'Versión correcta');
  assert(db.configuracion, 'Configuración existe');
  assert(Array.isArray(db.proyectos), 'Proyectos es array');
  assert(typeof db.proyectos_data === 'object', 'Proyectos_data es objeto');
}

// Test 2: Validación de estructura de DB
function testDBStructureValidation() {
  logInfo('\n--- Test 2: Validación de estructura de DB ---');
  const db = loadDB();

  assert(typeof db === 'object', 'DB es un objeto');
  assert(typeof db.version === 'string', 'Version es string');
  assert(typeof db.configuracion === 'object', 'Configuración es objeto');
  assert(Array.isArray(db.proyectos), 'Proyectos es array');
  assert(typeof db.proyectos_data === 'object', 'Proyectos_data es objeto');
  assert(Array.isArray(db.reportes), 'Reportes es array');
}

// Test 3: Validación de campos requeridos en configuración
function testConfiguracionRequiredFields() {
  logInfo('\n--- Test 3: Campos requeridos en configuración ---');
  const db = loadDB();
  const config = db.configuracion;

  assert(typeof config.nombre_empresa === 'string', 'nombre_empresa existe');
  assert(typeof config.eslogan === 'string', 'eslogan existe');
  assert(typeof config.presupuesto_inicial_caja === 'number', 'presupuesto_inicial_caja existe');
  assert('proyecto_actual' in config, 'proyecto_actual existe');
}

// Test 4: Validación de estructura de proyecto
function testProjectStructure() {
  logInfo('\n--- Test 4: Estructura de proyecto ---');
  const db = loadDB();
  const project = {
    id: 'proj_1',
    nombre: 'Proyecto Test',
    presupuesto: 100000,
    fecha_creacion: '2026-09-30',
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
  saveDB(db);

  const loaded = loadDB();
  const projData = loaded.proyectos_data['proj_1'];

  assert(Array.isArray(projData.caja_chica), 'caja_chica es array');
  assert(typeof projData.maquinaria_flota === 'object', 'maquinaria_flota es objeto');
  assert(Array.isArray(projData.maquinaria_flota.vehiculos), 'vehiculos es array');
  assert(Array.isArray(projData.maquinaria_flota.registros), 'registros es array');
  assert(typeof projData.personal === 'object', 'personal es objeto');
  assert(Array.isArray(projData.personal.trabajadores), 'trabajadores es array');
  assert(Array.isArray(projData.personal.asistencia), 'asistencia es array');
}

// Test 5: Manejo de JSON inválido
function testInvalidJSONHandling() {
  logInfo('\n--- Test 5: Manejo de JSON inválido ---');
  try {
    fs.writeFileSync(DB_FILE, '{ json inválido }');
    const loaded = loadDB();
    assert(false, 'Debería haber lanzado error');
  } catch (error) {
    assert(error instanceof SyntaxError, 'Error de sintaxis JSON capturado');
    logSuccess('Error de JSON inválido manejado correctamente');
  }

  // Restaurar DB válida con proyecto
  const dbWithProject = JSON.parse(JSON.stringify(validDB));
  const project = {
    id: 'proj_1',
    nombre: 'Proyecto Test',
    presupuesto: 100000,
    fecha_creacion: '2026-09-30',
    activo: true,
  };
  dbWithProject.proyectos.push(project);
  dbWithProject.proyectos_data[project.id] = {
    caja_chica: [],
    maquinaria_flota: { vehiculos: [], registros: [] },
    personal: { trabajadores: [], asistencia: [] },
    adquisiciones: { proveedores: [], cotizaciones_compras: [] },
    viajes_camiones: { rutas_botadero: [], camiones: [], equipo_alquilado: [], viajes: [] },
    mantenimiento: { maquinaria: [], formatos: {}, ordenes: [], compras_insumos: [] },
  };
  saveDB(dbWithProject);
}

// Test 6: Validación de tipos de datos en movimientos
function testMovementDataTypes() {
  logInfo('\n--- Test 6: Tipos de datos en movimientos ---');
  const db = loadDB();
  const movimiento = {
    id: 'mov_1',
    tipo: 'egreso',
    monto: 150.5,
    descripcion: 'Test',
    fecha: '2026-09-30',
  };

  db.proyectos_data['proj_1'].caja_chica.push(movimiento);
  saveDB(db);

  const loaded = loadDB();
  const mov = loaded.proyectos_data['proj_1'].caja_chica[0];

  assert(typeof mov.id === 'string', 'ID es string');
  assert(typeof mov.tipo === 'string', 'Tipo es string');
  assert(typeof mov.monto === 'number', 'Monto es number');
  assert(typeof mov.descripcion === 'string', 'Descripción es string');
  assert(typeof mov.fecha === 'string', 'Fecha es string');
}

// Test 7: Validación de IDs únicos
function testUniqueIDs() {
  logInfo('\n--- Test 7: IDs únicos ---');
  const db = loadDB();
  // Limpiar movimientos existentes
  db.proyectos_data['proj_1'].caja_chica = [];

  const ids = new Set();

  // Agregar varios movimientos
  for (let i = 0; i < 5; i++) {
    const mov = {
      id: `mov_unique_${i}`,
      tipo: 'egreso',
      monto: 100 + i,
      descripcion: `Test ${i}`,
      fecha: '2026-09-30',
    };
    db.proyectos_data['proj_1'].caja_chica.push(mov);
    ids.add(mov.id);
  }

  saveDB(db);
  const loaded = loadDB();
  const loadedIds = loaded.proyectos_data['proj_1'].caja_chica.map((m) => m.id);
  const uniqueLoadedIds = new Set(loadedIds);

  assert(loadedIds.length === uniqueLoadedIds.size, 'Todos los IDs son únicos');
  assert(ids.size === 5, '5 IDs únicos creados');
}

// Test 8: Validación de fechas
function testDateValidation() {
  logInfo('\n--- Test 8: Validación de fechas ---');
  const db = loadDB();
  const fechaValida = '2026-09-30';
  const fechaInvalida = 'invalid-date';

  // Fecha válida
  const mov1 = {
    id: 'mov_date_1',
    tipo: 'egreso',
    monto: 100,
    descripcion: 'Test fecha válida',
    fecha: fechaValida,
  };

  db.proyectos_data['proj_1'].caja_chica.push(mov1);
  saveDB(db);

  const loaded = loadDB();
  assert(
    loaded.proyectos_data['proj_1'].caja_chica.find((m) => m.id === 'mov_date_1').fecha ===
      fechaValida,
    'Fecha válida guardada'
  );
}

// Test 9: Validación de montos numéricos
function testAmountValidation() {
  logInfo('\n--- Test 9: Validación de montos ---');
  const db = loadDB();

  const montos = [0, 100.5, 999999.99, -100];
  montos.forEach((monto, idx) => {
    const mov = {
      id: `mov_monto_${idx}`,
      tipo: monto >= 0 ? 'ingreso' : 'egreso',
      monto: Math.abs(monto),
      descripcion: `Test monto ${monto}`,
      fecha: '2026-09-30',
    };
    db.proyectos_data['proj_1'].caja_chica.push(mov);
  });

  saveDB(db);
  const loaded = loadDB();

  montos.forEach((monto, idx) => {
    const mov = loaded.proyectos_data['proj_1'].caja_chica.find((m) => m.id === `mov_monto_${idx}`);
    assert(typeof mov.monto === 'number', `Monto ${monto} es number`);
    assert(Number.isFinite(mov.monto), `Monto ${monto} es finito`);
  });
}

// Test 10: Validación de persistencia
function testPersistence() {
  logInfo('\n--- Test 10: Validación de persistencia ---');
  const db = loadDB();
  const originalLength = db.proyectos_data['proj_1'].caja_chica.length;

  // Cargar DB nuevamente
  const reloaded = loadDB();
  assert(
    reloaded.proyectos_data['proj_1'].caja_chica.length === originalLength,
    'Datos persistidos correctamente'
  );
}

// Ejecutar todos los tests
let exitCode = 0;
try {
  backupDB();

  testDBInitialization();
  testDBStructureValidation();
  testConfiguracionRequiredFields();
  testProjectStructure();
  testInvalidJSONHandling();
  testMovementDataTypes();
  testUniqueIDs();
  testDateValidation();
  testAmountValidation();
  testPersistence();

  logInfo('\n' + '='.repeat(50));
  logInfo(`RESULTADO: ${passed} passed, ${failed} failed`);
  logInfo('='.repeat(50));

  exitCode = failed > 0 ? 1 : 0;
} catch (error) {
  logError(`Error inesperado: ${error.message}`);
  exitCode = 1;
} finally {
  // El sandbox se destruye pase lo que pase, sin dejar archivos temporales.
  sandbox.cleanup();
}

process.exit(exitCode);

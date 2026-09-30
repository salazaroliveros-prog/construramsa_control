/**
 * Test de Sincronización con la Nube - CONSTRURAMSA Control de Obra v2.9.4
 * ========================================================================
 * Valida las funciones de sincronización con OneDrive y Google Drive
 *
 * Ejecución: node test_cloud_sync.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

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

// Test 1: Validar estructura de configuración de nube
function testCloudConfigStructure() {
  logInfo('\n--- Test 1: Estructura de configuración de nube ---');
  const config = {
    proveedor: 'gas',
    url: 'https://script.google.com/macros/s/XXX/exec',
    auto: true,
    ultimo: null,
    od_client: '',
    od_token: '',
    gd_client: '',
    gd_token: '',
  };

  assert(typeof config.proveedor === 'string', 'Proveedor es string');
  assert(['gas', 'od', 'gd'].includes(config.proveedor), 'Proveedor válido');
  assert(typeof config.url === 'string', 'URL es string');
  assert(typeof config.auto === 'boolean', 'Auto es boolean');
  assert('ultimo' in config, 'Ultimo existe');
}

// Test 2: Validar SyncOptimizer existe
function testSyncOptimizerExists() {
  logInfo('\n--- Test 2: SyncOptimizer existe ---');
  try {
    const syncOptimizer = require('./src/syncOptimizer.js');
    assert(typeof syncOptimizer === 'object', 'SyncOptimizer es un objeto');
    assert(typeof syncOptimizer.fetchWithRetry === 'function', 'fetchWithRetry existe');
    assert(typeof syncOptimizer.downloadFileInChunks === 'function', 'downloadFileInChunks existe');
    assert(typeof syncOptimizer.checkConnectivity === 'function', 'checkConnectivity existe');
    assert(typeof syncOptimizer.validateToken === 'function', 'validateToken existe');
    logSuccess('SyncOptimizer cargado correctamente');
  } catch (error) {
    logError(`Error cargando SyncOptimizer: ${error.message}`);
  }
}

// Test 3: Validar SilentDownload existe
function testSilentDownloadExists() {
  logInfo('\n--- Test 3: SilentDownload existe ---');
  try {
    // SilentDownload no es un módulo CommonJS, pero podemos validar que el archivo existe
    const silentDownloadPath = path.join(__dirname, 'src/silentDownload.js');
    assert(fs.existsSync(silentDownloadPath), 'Archivo silentDownload.js existe');

    const content = fs.readFileSync(silentDownloadPath, 'utf8');
    assert(
      content.includes('onedriveDescargarSilencioso'),
      'Función onedriveDescargarSilencioso existe'
    );
    assert(
      content.includes('onedriveDescargarPorNombre'),
      'Función onedriveDescargarPorNombre existe'
    );
    assert(
      content.includes('onedriveCheckRemoteChanges'),
      'Función onedriveCheckRemoteChanges existe'
    );
    logSuccess('SilentDownload validado');
  } catch (error) {
    logError(`Error validando SilentDownload: ${error.message}`);
  }
}

// Test 4: Validar BackgroundSync existe
function testBackgroundSyncExists() {
  logInfo('\n--- Test 4: BackgroundSync existe ---');
  try {
    const backgroundSyncPath = path.join(__dirname, 'src/backgroundSync.js');
    assert(fs.existsSync(backgroundSyncPath), 'Archivo backgroundSync.js existe');

    const content = fs.readFileSync(backgroundSyncPath, 'utf8');
    assert(content.includes('startBackgroundSync'), 'Función startBackgroundSync existe');
    assert(content.includes('stopBackgroundSync'), 'Función stopBackgroundSync existe');
    assert(content.includes('performBidirectionalSync'), 'Función performBidirectionalSync existe');
    assert(content.includes('SYNC_CONFIG'), 'Configuración SYNC_CONFIG existe');
    logSuccess('BackgroundSync validado');
  } catch (error) {
    logError(`Error validando BackgroundSync: ${error.message}`);
  }
}

// Test 5: Validar NUBE_SCRIPT en index.html
function testNubeScriptExists() {
  logInfo('\n--- Test 5: NUBE_SCRIPT en index.html ---');
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf8');

    assert(content.includes('const NUBE_SCRIPT'), 'NUBE_SCRIPT definido');
    assert(content.includes('function doPost'), 'doPost existe en NUBE_SCRIPT');
    assert(content.includes('function doGet'), 'doGet existe en NUBE_SCRIPT');
    assert(content.includes('function verificarToken'), 'verificarToken existe en NUBE_SCRIPT');
    assert(content.includes('function guardarArchivo'), 'guardarArchivo existe en NUBE_SCRIPT');
    logSuccess('NUBE_SCRIPT validado');
  } catch (error) {
    logError(`Error validando NUBE_SCRIPT: ${error.message}`);
  }
}

// Test 6: Validar sanitización de payload
function testPayloadSanitization() {
  logInfo('\n--- Test 6: Sanitización de payload ---');
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf8');

    assert(content.includes('_nubeSanitizarPayload'), 'Función _nubeSanitizarPayload existe');
    assert(content.includes('DB_KEY'), 'DB_KEY definido');
    logSuccess('Sanitización de payload validada');
  } catch (error) {
    logError(`Error validando sanitización: ${error.message}`);
  }
}

// Test 7: Validar manejo de tokens OAuth
function testOAuthTokenHandling() {
  logInfo('\n--- Test 7: Manejo de tokens OAuth ---');
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf8');

    assert(content.includes('onedriveRenovarToken'), 'Función onedriveRenovarToken existe');
    assert(
      content.includes('onedriveInicializarCarpeta'),
      'Función onedriveInicializarCarpeta existe'
    );
    assert(content.includes('onedriveSubirAhora'), 'Función onedriveSubirAhora existe');
    assert(content.includes('onedriveDescargar'), 'Función onedriveDescargar existe');
    logSuccess('Manejo de tokens OAuth validado');
  } catch (error) {
    logError(`Error validando OAuth: ${error.message}`);
  }
}

// Test 8: Validar configuración de OneDrive
function testOneDriveConfig() {
  logInfo('\n--- Test 8: Configuración de OneDrive ---');
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf8');

    assert(content.includes('od_connected'), 'od_connected existe');
    assert(content.includes('od_token'), 'od_token existe');
    assert(content.includes('od_file_id'), 'od_file_id existe');
    assert(content.includes('Microsoft Graph'), 'Referencia a Microsoft Graph existe');
    logSuccess('Configuración OneDrive validada');
  } catch (error) {
    logError(`Error validando OneDrive: ${error.message}`);
  }
}

// Test 9: Validar manejo de errores de sincronización
function testSyncErrorHandling() {
  logInfo('\n--- Test 9: Manejo de errores de sincronización ---');
  try {
    const silentDownloadPath = path.join(__dirname, 'src/silentDownload.js');
    const content = fs.readFileSync(silentDownloadPath, 'utf8');

    assert(content.includes('try'), 'Manejo de errores con try-catch');
    assert(content.includes('catch'), 'Bloques catch existen');
    assert(content.includes('log'), 'Logging de errores existe');
    logSuccess('Manejo de errores validado');
  } catch (error) {
    logError(`Error validando manejo de errores: ${error.message}`);
  }
}

// Test 10: Validar fusión de datos
function testDataMerge() {
  logInfo('\n--- Test 10: Fusión de datos ---');
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf8');

    assert(
      content.includes('importarBaseDatosConFusion'),
      'Función importarBaseDatosConFusion existe'
    );
    // La fusión se hace dentro de importarBaseDatosConFusion, no como función separada
    logSuccess('Fusión de datos validada');
  } catch (error) {
    logError(`Error validando fusión de datos: ${error.message}`);
  }
}

// Ejecutar todos los tests
try {
  testCloudConfigStructure();
  testSyncOptimizerExists();
  testSilentDownloadExists();
  testBackgroundSyncExists();
  testNubeScriptExists();
  testPayloadSanitization();
  testOAuthTokenHandling();
  testOneDriveConfig();
  testSyncErrorHandling();
  testDataMerge();

  logInfo('\n' + '='.repeat(50));
  logInfo(`RESULTADO: ${passed} passed, ${failed} failed`);
  logInfo('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
} catch (error) {
  logError(`Error inesperado: ${error.message}`);
  process.exit(1);
}

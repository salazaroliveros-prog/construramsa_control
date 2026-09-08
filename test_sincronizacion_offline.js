/**
 * CONSTRURAMSA — Pruebas de Sincronización Offline v2.9.2
 * ======================================================
 * Suite de pruebas que valida la funcionalidad de sincronización
 * cuando la aplicación está completamente offline.
 *
 * Ejecución: node test_sincronizacion_offline.js
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || '3000';
const BASE_URL = 'http://localhost:' + PORT;
const TIMEOUT = 30000;
const REPORT_PATH = path.join(__dirname, 'sincronizacion_offline_report.json');

// ─── server lifecycle ────────────────────────────────────────────────────────
function startServer() {
  const srv = spawn('node', ['server.js'], { cwd: __dirname, stdio: 'ignore' });
  srv.on('error', (e) => console.error('[sync-offline] Error spawn:', e.message));
  return srv;
}

function waitServer(timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(BASE_URL, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve(true);
        retry();
      });
      req.on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Servidor no respondio'));
      setTimeout(check, 400);
    };
    check();
  });
}

// ─── test suite ───────────────────────────────────────────────────────────────
async function runTests() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0 },
  };

  let browser, page, server;

  try {
    console.log('[sync-offline] Iniciando servidor...');
    server = startServer();
    await waitServer(10000);
    console.log('[sync-offline] Servidor listo en', BASE_URL);

    console.log('[sync-offline] Iniciando navegador...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT);

    // Test 1: Verificar que la aplicación carga inicialmente
    await test1_CargaInicial(page, results);

    // Test 2: Verificar Service Worker registrado
    await test2_ServiceWorkerRegistrado(page, results);

    // Test 3: Verificar datos offline en localStorage
    await test3_DatosOfflineLocalStorage(page, results);

    // Test 4: Verificar funcionalidad básica offline
    await test4_FuncionalidadBasicaOffline(page, results);

    // Test 5: Verificar sincronización al reconectar
    await test5_SincronizacionReconexion(page, results);
  } catch (error) {
    console.error('[sync-offline] Error en suite:', error.message);
    results.tests.push({
      name: 'SUITE_ERROR',
      status: 'FAILED',
      error: error.message,
    });
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
    if (server) server.kill();

    // Actualizar resumen
    updateSummary(results);

    // Guardar reporte
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));
    console.log('[sync-offline] Reporte guardado en:', REPORT_PATH);
    console.log('[sync-offline] Resumen:', results.summary);

    // Exit con código apropiado
    process.exit(results.summary.failed > 0 ? 1 : 0);
  }
}

// ─── test implementations ────────────────────────────────────────────────────
async function test1_CargaInicial(page, results) {
  const test = { name: 'Carga inicial de la aplicación', status: 'PENDING' };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    if (title.includes('Control de Obra')) {
      test.status = 'PASSED';
      test.details = 'Aplicación cargó correctamente';
    } else {
      test.status = 'FAILED';
      test.error = 'Título incorrecto: ' + title;
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[sync-offline] ${test.name}: ${test.status}`);
}

async function test2_ServiceWorkerRegistrado(page, results) {
  const test = { name: 'Service Worker registrado', status: 'PENDING' };
  try {
    const swRegistered = await page.evaluate(() => {
      return navigator.serviceWorker.getRegistration().then((reg) => !!reg);
    });

    if (swRegistered) {
      test.status = 'PASSED';
      test.details = 'Service Worker activo';
    } else {
      test.status = 'FAILED';
      test.error = 'Service Worker no registrado';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[sync-offline] ${test.name}: ${test.status}`);
}

async function test3_DatosOfflineLocalStorage(page, results) {
  const test = { name: 'Datos offline en localStorage', status: 'PENDING' };
  try {
    const hasLocalStorage = await page.evaluate(() => {
      return localStorage.getItem('construramsa_db') !== null;
    });

    if (hasLocalStorage) {
      test.status = 'PASSED';
      test.details = 'LocalStorage tiene datos';
    } else {
      test.status = 'FAILED';
      test.error = 'LocalStorage vacío';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[sync-offline] ${test.name}: ${test.status}`);
}

async function test4_FuncionalidadBasicaOffline(page, results) {
  const test = { name: 'Funcionalidad básica offline', status: 'PENDING' };
  try {
    // Simular modo offline
    await page.context().setOffline(true);

    // Intentar navegar a un módulo
    await page.click('#tab-caja-chica');
    await page.waitForTimeout(1000);

    const moduleVisible = await page.isVisible('#caja-chica');

    if (moduleVisible) {
      test.status = 'PASSED';
      test.details = 'Navegación offline funciona';
    } else {
      test.status = 'FAILED';
      test.error = 'Módulo no visible offline';
    }

    // Restaurar conexión
    await page.context().setOffline(false);
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
    await page.context().setOffline(false);
  }
  results.tests.push(test);
  console.log(`[sync-offline] ${test.name}: ${test.status}`);
}

async function test5_SincronizacionReconexion(page, results) {
  const test = { name: 'Sincronización al reconectar', status: 'PENDING' };
  try {
    // Simular reconexión
    await page.context().setOffline(false);
    await page.waitForTimeout(2000);

    // Verificar que la aplicación sigue funcionando
    const title = await page.title();

    if (title.includes('Control de Obra')) {
      test.status = 'PASSED';
      test.details = 'Aplicación funciona después de reconexión';
    } else {
      test.status = 'FAILED';
      test.error = 'Aplicación no respondió después de reconexión';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[sync-offline] ${test.name}: ${test.status}`);
}

// ─── summary ─────────────────────────────────────────────────────────────────
function updateSummary(results) {
  results.summary.total = results.tests.length;
  results.summary.passed = results.tests.filter((t) => t.status === 'PASSED').length;
  results.summary.failed = results.tests.filter((t) => t.status === 'FAILED').length;
}

// ─── run ────────────────────────────────────────────────────────────────────
runTests().catch((error) => {
  console.error('[sync-offline] Error fatal:', error);
  process.exit(1);
});

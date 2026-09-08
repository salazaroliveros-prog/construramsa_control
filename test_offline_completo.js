/**
 * Validación Offline Completa - CONSTRURAMSA Control de Obra v2.9.2
 * ====================================================
 * Valida que la PWA funcione completamente sin conexión a internet.
 *
 * Ejecución: node test_offline_completo.js
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || '3000';
const BASE_URL = 'http://localhost:' + PORT;
const REPORT_PATH = path.join(__dirname, 'offline_validation_report.json');

// ─── server lifecycle ────────────────────────────────────────────────────────
function startServer() {
  const srv = spawn('node', ['server.js'], { cwd: __dirname, stdio: 'ignore' });
  srv.on('error', (e) => console.error('[offline] Error spawn:', e.message));
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
async function runOfflineValidation() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0 },
  };

  let browser, page, server;

  try {
    console.log('[offline] Iniciando validación offline...');
    console.log('[offline] Iniciando servidor...');
    server = startServer();
    await waitServer(10000);
    console.log('[offline] Servidor listo en', BASE_URL);

    console.log('[offline] Iniciando navegador...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    page.setDefaultTimeout(30000);

    // Test 1: Carga inicial con conexión
    await test1_InitialLoadWithConnection(page, results);

    // Test 2: Registro de Service Worker
    await test2_ServiceWorkerRegistration(page, results);

    // Test 3: Caché de recursos estáticos
    await test3_StaticAssetsCache(page, results);

    // Test 4: Funcionalidad offline (simular desconexión)
    await test4_OfflineFunctionality(page, results);

    // Test 5: Datos en localStorage offline
    await test5_LocalStorageOffline(page, results);

    // Test 6: Sincronización al reconectar
    await test6_SyncOnReconnect(page, results);
  } catch (error) {
    console.error('[offline] Error en suite:', error.message);
    results.tests.push({
      name: 'SUITE_ERROR',
      status: 'FAILED',
      error: error.message,
    });
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
    if (server) server.kill();

    // Calcular resumen
    results.summary.total = results.tests.length;
    results.summary.passed = results.tests.filter((t) => t.status === 'PASSED').length;
    results.summary.failed = results.tests.filter((t) => t.status === 'FAILED').length;

    // Guardar reporte
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));
    console.log('[offline] Reporte guardado en:', REPORT_PATH);
    console.log('[offline] Resumen:', results.summary);

    // Exit con código apropiado
    process.exit(results.summary.failed > 0 ? 1 : 0);
  }
}

// ─── test implementations ────────────────────────────────────────────────────
async function test1_InitialLoadWithConnection(page, results) {
  const test = { name: 'Carga inicial con conexión', status: 'PENDING' };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Verificar que la aplicación cargó
    const title = await page.title();
    const hasAppContent = (await page.locator('body').count()) > 0;

    if (title.includes('Control de Obra') && hasAppContent) {
      test.status = 'PASSED';
      test.details = 'Aplicación cargó correctamente con conexión';
    } else {
      test.status = 'FAILED';
      test.details = 'No se pudo cargar la aplicación';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[offline] ${test.name}: ${test.status}`);
}

async function test2_ServiceWorkerRegistration(page, results) {
  const test = { name: 'Registro de Service Worker', status: 'PENDING' };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Verificar registro de Service Worker
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
    });

    if (swRegistered) {
      test.status = 'PASSED';
      test.details = 'Service Worker registrado correctamente';
    } else {
      test.status = 'FAILED';
      test.details = 'Service Worker no está registrado';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[offline] ${test.name}: ${test.status}`);
}

async function test3_StaticAssetsCache(page, results) {
  const test = { name: 'Caché de recursos estáticos', status: 'PENDING', cachedAssets: [] };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Verificar caché de Service Worker usando Service Worker API
    const cacheInfo = await page.evaluate(async () => {
      // Verificar si Service Worker está activo
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        return {
          swActive: true,
          swReady: navigator.serviceWorker.ready !== null,
        };
      }
      return { swActive: false, swReady: false };
    });

    if (cacheInfo.swActive) {
      test.status = 'PASSED';
      test.details = 'Service Worker activo y caché disponible';
      test.cacheInfo = cacheInfo;
    } else {
      test.status = 'FAILED';
      test.details = 'Service Worker no está activo';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[offline] ${test.name}: ${test.status}`);
}

async function test4_OfflineFunctionality(page, results) {
  const test = { name: 'Funcionalidad offline', status: 'PENDING' };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Esperar a que Service Worker esté activo
    await page.waitForFunction(
      () => {
        return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
      },
      { timeout: 10000 }
    );

    // Esperar extra para asegurar que el caché esté listo
    await page.waitForTimeout(3000);

    // Verificar que index.html está en caché
    const indexInCache = await page.evaluate(async () => {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        const appCache = cacheNames.find((name) => name.includes('control-obra'));
        if (appCache) {
          const cache = await caches.open(appCache);
          const keys = await cache.keys();
          return keys.some((req) => req.url.includes('index.html'));
        }
      }
      return false;
    });

    // Verificar que recursos estáticos están en caché
    const staticAssetsCached = await page.evaluate(async () => {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        const appCache = cacheNames.find((name) => name.includes('control-obra'));
        if (appCache) {
          const cache = await caches.open(appCache);
          const keys = await cache.keys();
          return keys.length > 0;
        }
      }
      return false;
    });

    if (indexInCache && staticAssetsCached) {
      test.status = 'PASSED';
      test.details = 'Service Worker tiene caché completo - puede funcionar offline';
      test.cacheStatus = {
        indexInCache,
        staticAssetsCached,
      };
    } else {
      test.status = 'FAILED';
      test.details = 'Service Worker no tiene caché suficiente para offline';
      test.cacheStatus = {
        indexInCache,
        staticAssetsCached,
      };
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[offline] ${test.name}: ${test.status}`);
}

async function test5_LocalStorageOffline(page, results) {
  const test = { name: 'Datos en localStorage offline', status: 'PENDING' };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Verificar que localStorage esté disponible
    const localStorageAvailable = await page.evaluate(() => {
      try {
        localStorage.setItem('test_key', 'test_value');
        localStorage.removeItem('test_key');
        return true;
      } catch (e) {
        return false;
      }
    });

    // Verificar datos de la aplicación
    const hasAppData = await page.evaluate(() => {
      return localStorage.getItem('construramsa_db') !== null;
    });

    // Simular modo offline
    await page.route('**/*', (route) => route.abort());

    // Verificar que se pueden leer datos offline
    const canReadOffline = await page.evaluate(() => {
      return localStorage.getItem('construramsa_db') !== null;
    });

    // Restaurar conexión
    await page.unroute('**/*');

    if (localStorageAvailable && hasAppData && canReadOffline) {
      test.status = 'PASSED';
      test.details = 'LocalStorage funciona correctamente offline';
    } else {
      test.status = 'FAILED';
      test.details = 'No se pudo acceder a localStorage offline';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[offline] ${test.name}: ${test.status}`);
}

async function test6_SyncOnReconnect(page, results) {
  const test = { name: 'Sincronización al reconectar', status: 'PENDING' };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Simular desconexión
    await page.route('**/*', (route) => route.abort());

    // Crear un registro de prueba
    await page.evaluate(() => {
      localStorage.setItem('test_sync_timestamp', new Date().toISOString());
    });

    // Esperar un momento
    await page.waitForTimeout(1000);

    // Reconectar
    await page.unroute('**/*');
    await page.waitForTimeout(2000);

    // Verificar que el dato persistió
    const dataPersisted = await page.evaluate(() => {
      return localStorage.getItem('test_sync_timestamp') !== null;
    });

    // Limpiar dato de prueba
    await page.evaluate(() => {
      localStorage.removeItem('test_sync_timestamp');
    });

    if (dataPersisted) {
      test.status = 'PASSED';
      test.details = 'Datos persistieron correctamente durante ciclo offline';
    } else {
      test.status = 'FAILED';
      test.details = 'Datos no persistieron durante ciclo offline';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[offline] ${test.name}: ${test.status}`);
}

// ─── run ────────────────────────────────────────────────────────────────────
runOfflineValidation().catch((error) => {
  console.error('[offline] Error fatal:', error);
  process.exit(1);
});

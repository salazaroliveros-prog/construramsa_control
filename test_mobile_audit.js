/**
 * Auditoría Móvil Completa - CONSTRURAMSA Control de Obra v2.2
 * ========================================================
 * Valida que la aplicación funcione perfectamente en móviles Android/iOS
 * con todos sus módulos optimizados al 100%.
 *
 * Ejecución: node test_mobile_audit.js
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || '3000';
const BASE_URL = 'http://localhost:' + PORT;
const REPORT_PATH = path.join(__dirname, 'mobile_audit_report.json');

// ─── server lifecycle ────────────────────────────────────────────────────────
function startServer() {
  const srv = spawn('node', ['server.js'], { cwd: __dirname, stdio: 'ignore' });
  srv.on('error', (e) => console.error('[mobile] Error spawn:', e.message));
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

// ─── viewports móviles ─────────────────────────────────────────────────────────────
const MOBILE_VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667, deviceScaleFactor: 2 },
  { name: 'iPhone 12', width: 390, height: 844, deviceScaleFactor: 3 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932, deviceScaleFactor: 3 },
  { name: 'Pixel 5', width: 393, height: 851, deviceScaleFactor: 2.625 },
  { name: 'Samsung Galaxy S21', width: 360, height: 800, deviceScaleFactor: 3 },
  { name: 'iPad Mini', width: 768, height: 1024, deviceScaleFactor: 2 },
];

// ─── test suite ───────────────────────────────────────────────────────────────
async function runMobileAudit() {
  const results = {
    timestamp: new Date().toISOString(),
    viewports: [],
    summary: { total: 0, passed: 0, failed: 0 },
  };

  let browser, page, server;

  try {
    console.log('[mobile] Iniciando auditoría móvil...');
    console.log('[mobile] Iniciando servidor...');
    server = startServer();
    await waitServer(10000);
    console.log('[mobile] Servidor listo en', BASE_URL);

    console.log('[mobile] Iniciando navegador...');
    browser = await chromium.launch({ headless: true });

    // Probar cada viewport móvil
    for (const viewport of MOBILE_VIEWPORTS) {
      console.log(`[mobile] \n═══════════════════════════════════════════════════`);
      console.log(
        `[mobile] Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`
      );

      const viewportResult = await testViewport(browser, viewport);
      results.viewports.push(viewportResult);

      if (viewportResult.status === 'PASSED') {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
      results.summary.total++;
    }
  } catch (error) {
    console.error('[mobile] Error en suite:', error.message);
    results.tests.push({
      name: 'SUITE_ERROR',
      status: 'FAILED',
      error: error.message,
    });
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
    if (server) server.kill();

    // Guardar reporte
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));
    console.log('[mobile] Reporte guardado en:', REPORT_PATH);
    console.log('[mobile] Resumen:', results.summary);

    // Exit con código apropiado
    process.exit(results.summary.failed > 0 ? 1 : 0);
  }
}

// ─── test implementations ────────────────────────────────────────────────────
async function testViewport(browser, viewport) {
  const result = {
    viewport: viewport.name,
    dimensions: `${viewport.width}x${viewport.height}`,
    status: 'PENDING',
    tests: [],
  };

  let page;

  try {
    page = await browser.newPage();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    // Navegar a la aplicación
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test 1: Carga inicial
    await test1_InitialLoad(page, result);

    // Test 2: Meta viewport
    await test2_ViewportMeta(page, result);

    // Test 3: Service Worker
    await test3_ServiceWorker(page, result);

    // Test 4: Navegación tabs
    await test4_NavigationTabs(page, result);

    // Test 5: Touch targets
    await test5_TouchTargets(page, result);

    // Test 6: Formularios móviles
    await test6_MobileForms(page, result);

    // Test 7: Scroll funcional
    await test7_MobileScroll(page, result);

    // Test 8: Modales móviles
    await test8_MobileModals(page, result);

    // Test 9: Performance móvil
    await test9_MobilePerformance(page, result);

    // Test 10: Orientación landscape
    await test10_LandscapeOrientation(page, result);

    // Calcular resultado final
    const passed = result.tests.filter((t) => t.status === 'PASSED').length;
    const failed = result.tests.filter((t) => t.status === 'FAILED').length;

    result.status = failed === 0 ? 'PASSED' : 'FAILED';
    result.summary = { passed, failed, total: result.tests.length };
  } catch (error) {
    result.status = 'FAILED';
    result.error = error.message;
  } finally {
    if (page) await page.close();
  }

  return result;
}

async function test1_InitialLoad(page, result) {
  const test = { name: 'Carga inicial', status: 'PENDING' };
  try {
    const title = await page.title();
    const bodyVisible = await page.locator('body').isVisible();
    const hasAppContent = (await page.locator('.container').count()) > 0;

    if (title.includes('Control de Obra') && bodyVisible && hasAppContent) {
      test.status = 'PASSED';
      test.details = 'Aplicación cargó correctamente en móvil';
    } else {
      test.status = 'FAILED';
      test.details = 'No se pudo cargar la aplicación en móvil';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  result.tests.push(test);
  console.log(`[mobile] ${test.name}: ${test.status}`);
}

async function test2_ViewportMeta(page, result) {
  const test = { name: 'Meta viewport', status: 'PENDING' };
  try {
    const viewportMeta = await page.getAttribute('meta[name="viewport"]', 'content');

    if (viewportMeta) {
      const hasInteractiveWidget = viewportMeta.includes('interactive-widget=resizes-content');
      const hasViewportFit = viewportMeta.includes('viewport-fit=cover');
      const hasProperScale = viewportMeta.includes('initial-scale=1.0');

      if (hasInteractiveWidget && hasViewportFit && hasProperScale) {
        test.status = 'PASSED';
        test.details = 'Meta viewport optimizado para móvil';
        test.meta = viewportMeta;
      } else {
        test.status = 'FAILED';
        test.details = 'Meta viewport no optimizado para móvil';
        test.meta = viewportMeta;
      }
    } else {
      test.status = 'FAILED';
      test.details = 'Meta viewport no encontrado';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  result.tests.push(test);
  console.log(`[mobile] ${test.name}: ${test.status}`);
}

async function test3_ServiceWorker(page, result) {
  const test = { name: 'Service Worker', status: 'PENDING' };
  try {
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
    });

    if (swRegistered) {
      test.status = 'PASSED';
      test.details = 'Service Worker registrado en móvil';
    } else {
      test.status = 'FAILED';
      test.details = 'Service Worker no registrado en móvil';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  result.tests.push(test);
  console.log(`[mobile] ${test.name}: ${test.status}`);
}

async function test4_NavigationTabs(page, result) {
  const test = { name: 'Navegación tabs', status: 'PENDING' };
  try {
    const tabsVisible = await page.locator('.nav-tabs').isVisible();
    const tabsClickable = (await page.locator('.nav-tab').count()) > 0;

    if (!tabsVisible || !tabsClickable) {
      test.status = 'FAILED';
      test.details = 'Tabs no visibles o no clickeables';
      result.tests.push(test);
      console.log(`[mobile] ${test.name}: ${test.status}`);
      return;
    }

    // Probar clic en tabs con espera (usar IDs correctos)
    await page.click('#tab-caja-chica', { timeout: 5000 });
    await page.waitForTimeout(1500);

    const cajaChicaLoaded = (await page.locator('#caja-chica').count()) > 0;

    await page.click('#tab-resumen', { timeout: 5000 });
    await page.waitForTimeout(1500);

    const resumenLoaded = (await page.locator('#resumen').count()) > 0;

    if (cajaChicaLoaded || resumenLoaded) {
      test.status = 'PASSED';
      test.details = 'Navegación por tabs funciona en móvil';
    } else {
      test.status = 'FAILED';
      test.details = 'Navegación por tabs no funciona en móvil';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  result.tests.push(test);
  console.log(`[mobile] ${test.name}: ${test.status}`);
}

async function test5_TouchTargets(page, result) {
  const test = { name: 'Touch targets', status: 'PENDING' };
  try {
    // Verificar tamaño de botones (mínimo 44x44px para touch)
    const buttons = await page.locator('button, .btn-primario, .btn-secundario, .nav-tab').all();

    let minTouchSize = Infinity;
    let buttonCount = 0;

    for (const button of buttons) {
      try {
        const box = await button.boundingBox();
        if (box) {
          const minDimension = Math.min(box.width, box.height);
          minTouchSize = Math.min(minTouchSize, minDimension);
          buttonCount++;
        }
      } catch (e) {
        // Skip buttons that can't be measured
      }
    }

    if (buttonCount === 0) {
      test.status = 'PASSED';
      test.details = 'No hay botones para medir';
    } else if (minTouchSize >= 44) {
      test.status = 'PASSED';
      test.details = `Touch targets adecuados (mínimo: ${minTouchSize}px, buttons: ${buttonCount})`;
    } else {
      test.status = 'FAILED';
      test.details = `Touch targets muy pequeños (mínimo: ${minTouchSize}px, buttons: ${buttonCount})`;
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  result.tests.push(test);
  console.log(`[mobile] ${test.name}: ${test.status}`);
}

async function test6_MobileForms(page, result) {
  const test = { name: 'Formularios móviles', status: 'PENDING' };
  try {
    // Probar input en un formulario
    await page.click('#tab-caja-chica');
    await page.waitForTimeout(1000);

    const inputVisible = (await page.locator('input[type="text"]').count()) > 0;
    const inputTouchOptimized = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        const style = window.getComputedStyle(input);
        if (style.fontSize && parseFloat(style.fontSize) >= 16) {
          return true;
        }
      }
      return false;
    });

    if (inputVisible && inputTouchOptimized) {
      test.status = 'PASSED';
      test.details = 'Formularios optimizados para touch en móvil';
    } else {
      test.status = 'FAILED';
      test.details = 'Formularios no optimizados para touch en móvil';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  result.tests.push(test);
  console.log(`[mobile] ${test.name}: ${test.status}`);
}

async function test7_MobileScroll(page, result) {
  const test = { name: 'Scroll funcional', status: 'PENDING' };
  try {
    const hasScrollableContent = await page.evaluate(() => {
      const body = document.body;
      return body.scrollHeight > body.clientHeight;
    });

    if (hasScrollableContent) {
      // Probar scroll
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(500);

      const scrollPosition = await page.evaluate(() => window.scrollY);

      if (scrollPosition > 0) {
        test.status = 'PASSED';
        test.details = 'Scroll funciona correctamente en móvil';
      } else {
        test.status = 'FAILED';
        test.details = 'Scroll no funciona en móvil';
      }
    } else {
      test.status = 'PASSED';
      test.details = 'No necesita scroll (contenido cabe en pantalla)';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  result.tests.push(test);
  console.log(`[mobile] ${test.name}: ${test.status}`);
}

async function test8_MobileModals(page, result) {
  const test = { name: 'Modales móviles', status: 'PENDING' };
  try {
    // Probar abrir un modal
    await page.click('#tab-caja-chica');
    await page.waitForTimeout(1000);

    // Intentar abrir modal de reporte
    const reportButton = await page.locator('button:has-text("Generar Reporte")').first();
    if (await reportButton.isVisible()) {
      await reportButton.click();
      await page.waitForTimeout(1000);

      const modalVisible = (await page.locator('.modal').count()) > 0;

      if (modalVisible) {
        // Cerrar modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        test.status = 'PASSED';
        test.details = 'Modales funcionan correctamente en móvil';
      } else {
        test.status = 'FAILED';
        test.details = 'Modales no funcionan en móvil';
      }
    } else {
      test.status = 'PASSED';
      test.details = 'No hay modales para probar';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  result.tests.push(test);
  console.log(`[mobile] ${test.name}: ${test.status}`);
}

async function test9_MobilePerformance(page, result) {
  const test = { name: 'Performance móvil', status: 'PENDING' };
  try {
    const metrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: perfData.loadEventEnd - perfData.fetchStart,
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.fetchStart,
        firstPaint: perfData.responseStart - perfData.fetchStart,
      };
    });

    // Performance aceptable para móvil (<3s)
    const acceptableLoadTime = metrics.loadTime < 3000;

    if (acceptableLoadTime) {
      test.status = 'PASSED';
      test.details = `Performance aceptable (${metrics.loadTime}ms)`;
      test.metrics = metrics;
    } else {
      test.status = 'FAILED';
      test.details = `Performance lento (${metrics.loadTime}ms)`;
      test.metrics = metrics;
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  result.tests.push(test);
  console.log(`[mobile] ${test.name}: ${test.status}`);
}

async function test10_LandscapeOrientation(page, result) {
  const test = { name: 'Orientación landscape', status: 'PENDING' };
  try {
    // Probar orientación landscape
    await page.setViewportSize({ width: 926, height: 428 });
    await page.waitForTimeout(1000);

    const bodyVisible = await page.locator('body').isVisible();
    const hasAppContent = (await page.locator('.container').count()) > 0;

    // Restaurar portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    if (bodyVisible && hasAppContent) {
      test.status = 'PASSED';
      test.details = 'Orientación landscape funciona en móvil';
    } else {
      test.status = 'FAILED';
      test.details = 'Orientación landscape no funciona en móvil';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  result.tests.push(test);
  console.log(`[mobile] ${test.name}: ${test.status}`);
}

// ─── run ────────────────────────────────────────────────────────────────────
runMobileAudit().catch((error) => {
  console.error('[mobile] Error fatal:', error);
  process.exit(1);
});

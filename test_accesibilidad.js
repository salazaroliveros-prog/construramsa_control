/**
 * Tests de Accesibilidad - CONSTRURAMSA Control de Obra v2.9.2
 * =====================================================
 * Suite de pruebas de accesibilidad usando aXe y Playwright.
 * Valida WCAG 2.1 AA compliance.
 *
 * Ejecución: node test_accesibilidad.js
 */

'use strict';

const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || '3000';
const BASE_URL = 'http://localhost:' + PORT;
const TIMEOUT = 30000;
const REPORT_PATH = path.join(__dirname, 'accesibilidad_report.json');

// ─── server lifecycle ────────────────────────────────────────────────────────
function startServer() {
  const srv = spawn('node', ['server.js'], { cwd: __dirname, stdio: 'ignore' });
  srv.on('error', (e) => console.error('[a11y] Error spawn:', e.message));
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
async function runAccessibilityTests() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, violations: 0 },
  };

  let browser, page, server;

  try {
    console.log('[a11y] Iniciando servidor...');
    server = startServer();
    await waitServer(10000);
    console.log('[a11y] Servidor listo en', BASE_URL);

    console.log('[a11y] Iniciando navegador...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT);

    // Test 1: Accesibilidad de página principal
    await test1_MainPageAccessibility(page, results);

    // Test 2: Accesibilidad de cada módulo
    await test2_ModulesAccessibility(page, results);

    // Test 3: Navegación por teclado
    await test3_KeyboardNavigation(page, results);

    // Test 4: Contraste de colores
    await test4_ColorContrast(page, results);

    // Test 5: ARIA labels y roles
    await test5_ARIACompliance(page, results);
  } catch (error) {
    console.error('[a11y] Error en suite:', error.message);
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
    console.log('[a11y] Reporte guardado en:', REPORT_PATH);
    console.log('[a11y] Resumen:', results.summary);

    // Exit con código apropiado
    process.exit(results.summary.failed > 0 ? 1 : 0);
  }
}

// ─── test implementations ────────────────────────────────────────────────────
async function test1_MainPageAccessibility(page, results) {
  const test = { name: 'Accesibilidad página principal', status: 'PENDING', violations: [] };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    test.violations = accessibilityScanResults.violations;
    test.status = accessibilityScanResults.violations.length === 0 ? 'PASSED' : 'FAILED';
    test.details = `${accessibilityScanResults.violations.length} violaciones encontradas`;

    results.summary.violations += accessibilityScanResults.violations.length;
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[a11y] ${test.name}: ${test.status}`);
}

async function test2_ModulesAccessibility(page, results) {
  const test = { name: 'Accesibilidad de módulos', status: 'PENDING', moduleResults: [] };
  const modules = [
    'caja-chica',
    'maquinaria',
    'personal',
    'adquisiciones',
    'viajes',
    'mantenimiento',
    'reportes',
    'configuracion',
  ];

  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    for (const module of modules) {
      try {
        await page.click(`#tab-${module}`);
        await page.waitForTimeout(1000);

        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
        const moduleResult = {
          module,
          violations: accessibilityScanResults.violations.length,
          status: accessibilityScanResults.violations.length === 0 ? 'PASSED' : 'FAILED',
        };

        test.moduleResults.push(moduleResult);
        results.summary.violations += accessibilityScanResults.violations.length;
      } catch (error) {
        test.moduleResults.push({ module, status: 'ERROR', error: error.message });
      }
    }

    const failedModules = test.moduleResults.filter((r) => r.status !== 'PASSED');
    test.status = failedModules.length === 0 ? 'PASSED' : 'FAILED';
    test.details = `${failedModules.length}/${modules.length} módulos pasaron`;
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[a11y] ${test.name}: ${test.status}`);
}

async function test3_KeyboardNavigation(page, results) {
  const test = { name: 'Navegación por teclado', status: 'PENDING' };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Probar navegación por tabs
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verificar que el foco esté en un elemento interactivo
    const focusedElement = await page.evaluate(() => {
      const focused = document.activeElement;
      return {
        tagName: focused.tagName,
        hasTabindex: focused.hasAttribute('tabindex'),
        isInteractive: ['BUTTON', 'INPUT', 'SELECT', 'A', 'BUTTON'].includes(focused.tagName),
      };
    });

    if (focusedElement.isInteractive || focusedElement.hasTabindex) {
      test.status = 'PASSED';
      test.details = 'Navegación por teclado funciona correctamente';
    } else {
      test.status = 'FAILED';
      test.details = 'Foco no está en elemento interactivo';
    }
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[a11y] ${test.name}: ${test.status}`);
}

async function test4_ColorContrast(page, results) {
  const test = { name: 'Contraste de colores', status: 'PENDING', contrastIssues: [] };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'wcag21aa'])
      .analyze();

    // Filtrar solo violaciones de contraste
    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced'
    );

    test.contrastIssues = contrastViolations;
    test.status = contrastViolations.length === 0 ? 'PASSED' : 'FAILED';
    test.details = `${contrastViolations.length} problemas de contraste encontrados`;

    results.summary.violations += contrastViolations.length;
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[a11y] ${test.name}: ${test.status}`);
}

async function test5_ARIACompliance(page, results) {
  const test = { name: 'Cumplimiento ARIA', status: 'PENDING', ariaIssues: [] };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag21aa'])
      .analyze();

    // Filtrar violaciones relacionadas con ARIA
    const ariaViolations = accessibilityScanResults.violations.filter(
      (v) => v.id.includes('aria') || v.description.includes('ARIA')
    );

    test.ariaIssues = ariaViolations;
    test.status = ariaViolations.length === 0 ? 'PASSED' : 'FAILED';
    test.details = `${ariaViolations.length} problemas ARIA encontrados`;

    results.summary.violations += ariaViolations.length;
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[a11y] ${test.name}: ${test.status}`);
}

// ─── run ────────────────────────────────────────────────────────────────────
runAccessibilityTests().catch((error) => {
  console.error('[a11y] Error fatal:', error);
  process.exit(1);
});

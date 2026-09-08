/**
 * Tests de Performance (Lighthouse) - CONSTRURAMSA Control de Obra v2.9.2
 * ============================================================
 * Suite de pruebas de performance usando Lighthouse.
 * Valida Core Web Vitals y métricas de performance.
 *
 * Ejecución: node test_lighthouse.js
 */

'use strict';

const { chromium } = require('playwright');
const lighthouse = require('lighthouse');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || '3000';
const BASE_URL = 'http://localhost:' + PORT;
const TIMEOUT = 60000;
const REPORT_PATH = path.join(__dirname, 'lighthouse_report.json');

// ─── server lifecycle ────────────────────────────────────────────────────────
function startServer() {
  const srv = spawn('node', ['server.js'], { cwd: __dirname, stdio: 'ignore' });
  srv.on('error', (e) => console.error('[lighthouse] Error spawn:', e.message));
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
async function runLighthouseTests() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, scores: {} },
  };

  let browser, page, server;

  try {
    console.log('[lighthouse] Iniciando servidor...');
    server = startServer();
    await waitServer(10000);
    console.log('[lighthouse] Servidor listo en', BASE_URL);

    console.log('[lighthouse] Iniciando navegador...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT);

    // Test 1: Performance Score
    await test1_PerformanceScore(page, results);

    // Test 2: Core Web Vitals
    await test2_CoreWebVitals(page, results);

    // Test 3: Accessibility Score
    await test3_AccessibilityScore(page, results);

    // Test 4: Best Practices
    await test4_BestPractices(page, results);

    // Test 5: SEO Score
    await test5_SEOScore(page, results);
  } catch (error) {
    console.error('[lighthouse] Error en suite:', error.message);
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
    console.log('[lighthouse] Reporte guardado en:', REPORT_PATH);
    console.log('[lighthouse] Resumen:', results.summary);

    // Exit con código apropiado
    process.exit(results.summary.failed > 0 ? 1 : 0);
  }
}

// ─── test implementations ────────────────────────────────────────────────────
async function test1_PerformanceScore(page, results) {
  const test = { name: 'Performance Score', status: 'PENDING', score: 0 };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const runnerResult = await lighthouse(BASE_URL, {
      port: new URL(browser.wsEndpoint()).port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
    });

    const score = runnerResult.categories.performance.score * 100;
    test.score = Math.round(score);
    test.status = score >= 90 ? 'PASSED' : 'FAILED';
    test.details = `Score: ${test.score}/100`;

    results.summary.scores.performance = test.score;
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[lighthouse] ${test.name}: ${test.status} (${test.score}/100)`);
}

async function test2_CoreWebVitals(page, results) {
  const test = { name: 'Core Web Vitals', status: 'PENDING', vitals: {} };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const runnerResult = await lighthouse(BASE_URL, {
      port: new URL(browser.wsEndpoint()).port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
    });

    const audits = runnerResult.audits;

    test.vitals = {
      lcp: {
        value: audits['largest-contentful-paint'].displayValue,
        score: audits['largest-contentful-paint'].score,
        status: audits['largest-contentful-paint'].score >= 0.9 ? 'PASSED' : 'FAILED',
      },
      fid: {
        value: audits['total-blocking-time'].displayValue,
        score: audits['total-blocking-time'].score,
        status: audits['total-blocking-time'].score >= 0.9 ? 'PASSED' : 'FAILED',
      },
      cls: {
        value: audits['cumulative-layout-shift'].displayValue,
        score: audits['cumulative-layout-shift'].score,
        status: audits['cumulative-layout-shift'].score >= 0.9 ? 'PASSED' : 'FAILED',
      },
    };

    const allPassed = Object.values(test.vitals).every((v) => v.status === 'PASSED');
    test.status = allPassed ? 'PASSED' : 'FAILED';
    test.details = `LCP: ${test.vitals.lcp.status}, FID: ${test.vitals.fid.status}, CLS: ${test.vitals.cls.status}`;
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[lighthouse] ${test.name}: ${test.status}`);
}

async function test3_AccessibilityScore(page, results) {
  const test = { name: 'Accessibility Score', status: 'PENDING', score: 0 };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const runnerResult = await lighthouse(BASE_URL, {
      port: new URL(browser.wsEndpoint()).port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['accessibility'],
    });

    const score = runnerResult.categories.accessibility.score * 100;
    test.score = Math.round(score);
    test.status = score >= 90 ? 'PASSED' : 'FAILED';
    test.details = `Score: ${test.score}/100`;

    results.summary.scores.accessibility = test.score;
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[lighthouse] ${test.name}: ${test.status} (${test.score}/100)`);
}

async function test4_BestPractices(page, results) {
  const test = { name: 'Best Practices', status: 'PENDING', score: 0 };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const runnerResult = await lighthouse(BASE_URL, {
      port: new URL(browser.wsEndpoint()).port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['best-practices'],
    });

    const score = runnerResult.categories['best-practices'].score * 100;
    test.score = Math.round(score);
    test.status = score >= 90 ? 'PASSED' : 'FAILED';
    test.details = `Score: ${test.score}/100`;

    results.summary.scores.bestPractices = test.score;
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[lighthouse] ${test.name}: ${test.status} (${test.score}/100)`);
}

async function test5_SEOScore(page, results) {
  const test = { name: 'SEO Score', status: 'PENDING', score: 0 };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const runnerResult = await lighthouse(BASE_URL, {
      port: new URL(browser.wsEndpoint()).port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['seo'],
    });

    const score = runnerResult.categories.seo.score * 100;
    test.score = Math.round(score);
    test.status = score >= 80 ? 'PASSED' : 'FAILED';
    test.details = `Score: ${test.score}/100`;

    results.summary.scores.seo = test.score;
  } catch (error) {
    test.status = 'FAILED';
    test.error = error.message;
  }
  results.tests.push(test);
  console.log(`[lighthouse] ${test.name}: ${test.status} (${test.score}/100)`);
}

// ─── run ────────────────────────────────────────────────────────────────────
runLighthouseTests().catch((error) => {
  console.error('[lighthouse] Error fatal:', error);
  process.exit(1);
});

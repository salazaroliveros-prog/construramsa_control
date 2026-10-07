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
const { once } = require('events');
const { default: lighthouse } = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || '3000';
const BASE_URL = 'http://localhost:' + PORT;
const TIMEOUT = 60000;
const REPORT_PATH = path.join(__dirname, 'lighthouse_report.json');
const PROFILE_PREFIX = path.join(__dirname, '.lighthouse-profile-');

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

async function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  server.kill();
  await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 5000))]);
}

// ─── test suite ───────────────────────────────────────────────────────────────
async function runLighthouseTests() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, scores: {} },
  };

  let browser, page, server, chrome, profileDir;

  try {
    console.log('[lighthouse] Iniciando servidor...');
    server = startServer();
    await waitServer(10000);
    console.log('[lighthouse] Servidor listo en', BASE_URL);

    console.log('[lighthouse] Iniciando navegador...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT);
    profileDir = fs.mkdtempSync(PROFILE_PREFIX);
    chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless', '--no-sandbox'],
      userDataDir: profileDir,
    });
    const lighthouseResult = await lighthouse(BASE_URL, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });
    if (!lighthouseResult || !lighthouseResult.lhr)
      throw new Error('Lighthouse did not return a report');

    // Test 1: Performance Score
    await test1_PerformanceScore(page, lighthouseResult.lhr, results);

    // Test 2: Core Web Vitals
    await test2_CoreWebVitals(page, lighthouseResult.lhr, results);

    // Test 3: Accessibility Score
    await test3_AccessibilityScore(page, lighthouseResult.lhr, results);

    // Test 4: Best Practices
    await test4_BestPractices(page, lighthouseResult.lhr, results);

    // Test 5: SEO Score
    await test5_SEOScore(page, lighthouseResult.lhr, results);
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
    // chrome-launcher cleans its automatic %TEMP% profile with a synchronous
    // Windows taskkill path that can throw EPERM. We own this profile, so end
    // its child process directly and then remove only our directory.
    if (chrome && chrome.process && !chrome.process.killed) chrome.process.kill();
    await stopServer(server);
    if (profileDir) {
      try {
        fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 10 });
      } catch (error) {
        console.warn('[lighthouse] No se pudo limpiar el perfil temporal:', error.message);
      }
    }

    results.summary.total = results.tests.length;
    results.summary.passed = results.tests.filter((test) => test.status === 'PASSED').length;
    results.summary.failed = results.tests.filter((test) => test.status === 'FAILED').length;

    // Guardar reporte
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));
    console.log('[lighthouse] Reporte guardado en:', REPORT_PATH);
    console.log('[lighthouse] Resumen:', results.summary);

    // Exit con código apropiado
    process.exit(results.summary.failed > 0 ? 1 : 0);
  }
}

// ─── test implementations ────────────────────────────────────────────────────
async function test1_PerformanceScore(page, runnerResult, results) {
  const test = { name: 'Performance Score', status: 'PENDING', score: 0 };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

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

async function test2_CoreWebVitals(page, runnerResult, results) {
  const test = { name: 'Core Web Vitals', status: 'PENDING', vitals: {} };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

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

async function test3_AccessibilityScore(page, runnerResult, results) {
  const test = { name: 'Accessibility Score', status: 'PENDING', score: 0 };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

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

async function test4_BestPractices(page, runnerResult, results) {
  const test = { name: 'Best Practices', status: 'PENDING', score: 0 };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

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

async function test5_SEOScore(page, runnerResult, results) {
  const test = { name: 'SEO Score', status: 'PENDING', score: 0 };
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

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

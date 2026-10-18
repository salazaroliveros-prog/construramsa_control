'use strict';

/* Regression tests for report-export UI guard clauses.  These exercise the
 * browser functions rather than a copied implementation. */
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const port = 8153;
const base = `http://127.0.0.1:${port}/`;

function waitForServer(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      const request = http.get(base, (response) => {
        response.resume();
        if (response.statusCode === 200) return resolve();
        retry();
      });
      request.on('error', retry);
      request.setTimeout(1000, () => {
        request.destroy();
        retry();
      });
    };
    const retry = () =>
      Date.now() >= deadline
        ? reject(new Error('Local server did not start'))
        : setTimeout(check, 150);
    check();
  });
}

async function loadSeed(page) {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'construramsa_db.json'), 'utf8'));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate((db) => localStorage.setItem('construramsa_db', JSON.stringify(db)), seed);
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.getElementById('reporte-tipo').value = 'diario';
    document.getElementById('reporte-fecha').value = '2026-10-17';
    document.getElementById('export-pdf').checked = false;
    document.getElementById('export-csv').checked = true;
    document.getElementById('export-xlsx').checked = false;
  });
}

async function main() {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port), NODE_OPTIONS: '' },
    stdio: 'ignore',
  });
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await loadSeed(page);

    await page.evaluate(() => {
      window.__reportPdfDependency = window.html2pdf;
      window.html2pdf = undefined;
      window.generarReporteLocal();
    });
    const csvDownload = await page.waitForEvent('download', { timeout: 5000 });
    assert.match(csvDownload.suggestedFilename(), /^reporte_diario_.*\.csv$/);

    await loadSeed(page);
    await page.evaluate(() => {
      document.getElementById('export-csv').checked = false;
      window.generarReporteLocal();
      document.getElementById('export-csv').checked = true;
      window.generarReporteLocal();
    });
    const unlockedDownload = await page.waitForEvent('download', { timeout: 5000 });
    assert.match(unlockedDownload.suggestedFilename(), /^reporte_diario_.*\.csv$/);

    await loadSeed(page);
    const fallbackDownloads = [];
    page.on('download', (download) => fallbackDownloads.push(download.suggestedFilename()));
    await page.evaluate(async () => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new Error('share rejected for test')),
      });
      await window.compartirReporteWhatsApp();
    });
    await page.waitForTimeout(5000);
    assert(
      fallbackDownloads.some((name) => /^reporte_diario_.*\.csv$/.test(name)),
      'a failed share must fall back to the selected local CSV export'
    );

    await loadSeed(page);
    const previewDownload = page.waitForEvent('download', { timeout: 5000 });
    await page.evaluate(() => window.confirmarYGenerar('local'));
    const savedPreviewDownload = await previewDownload;
    assert.match(
      savedPreviewDownload.suggestedFilename(),
      /^reporte_diario_.*\.csv$/,
      'the preview flow must reuse the local export path'
    );

    console.log('Report export UI guard tests OK');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

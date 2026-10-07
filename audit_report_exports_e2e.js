'use strict';

/* Generates actual CSV/PDF artifacts through the same browser functions used
 * by the UI, using a temporary Playwright profile and the project seed. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const port = 8152;
const base = `http://127.0.0.1:${port}/`;
const output = path.join(os.tmpdir(), 'construramsa-report-audit');
const types = [
  'diario',
  'semanal',
  'mensual',
  'asistencia',
  'viajes',
  'mantenimiento',
  'categoria',
  'nomina',
  'ejecutivo',
];
const range = { inicio: '2020-01-01', fin: '2030-12-31' };

function waitForServer(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const retry = () => {
      if (Date.now() >= deadline) reject(new Error('Local server did not start'));
      else setTimeout(check, 150);
    };
    const check = () => {
      const req = http.get(base, (res) => {
        res.resume();
        res.statusCode === 200 ? resolve() : retry();
      });
      req.on('error', retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };
    check();
  });
}

async function main() {
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'construramsa_db.json'), 'utf8'));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port), NODE_OPTIONS: '' },
    stdio: 'ignore',
  });
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate((db) => localStorage.setItem('construramsa_db', JSON.stringify(db)), seed);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const manifest = [];
    for (const type of types) {
      const artifact = await page.evaluate(
        async ({ type, range }) => {
          const csv = window.generarCSVReporte(type, range.inicio, range);
          const html = window.generarHTMLReporte(type, range.inicio, range);
          const container = window.prepararContenedorImpresion(`Reporte ${type}`, html);
          const pdf = await window.generarPDFPlantilla(container, `audit_${type}.pdf`);
          container.classList.remove('pdf-generating');
          return { csv, pdf: pdf.output('datauristring') };
        },
        { type, range }
      );
      const csvPath = path.join(output, `audit_${type}.csv`);
      const pdfPath = path.join(output, `audit_${type}.pdf`);
      fs.writeFileSync(csvPath, artifact.csv, 'utf8');
      fs.writeFileSync(pdfPath, Buffer.from(artifact.pdf.split(',')[1], 'base64'));
      manifest.push({
        type,
        csvPath,
        pdfPath,
        csvBytes: fs.statSync(csvPath).size,
        pdfBytes: fs.statSync(pdfPath).size,
      });
    }
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ output, artifacts: manifest }, null, 2));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

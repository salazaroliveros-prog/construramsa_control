'use strict';

/* Generates actual CSV/PDF/XLSX artifacts through the same browser functions used
 * by the UI, using a temporary Playwright profile and the project seed. */
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const port = 8152;
const base = `http://127.0.0.1:${port}/`;
const output = path.join(__dirname, 'temp_audit_reports');
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

function assertStoredFile(filePath, format) {
  assert(fs.existsSync(filePath), `${format} was not saved to disk: ${filePath}`);
  const content = fs.readFileSync(filePath);
  assert(content.length > 0, `${format} is empty: ${filePath}`);

  if (format === 'CSV') {
    assert(
      content.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
      'CSV is missing UTF-8 BOM'
    );
    assert.match(
      content.toString('utf8'),
      /CONSTRURAMSA|Reporte|REPORTE/i,
      'CSV has no report content'
    );
    return;
  }

  if (format === 'PDF') {
    assert(content.subarray(0, 5).equals(Buffer.from('%PDF-')), `Invalid PDF header: ${filePath}`);
    const pageCount = Number(
      execFileSync(
        'python',
        ['-c', 'import pymupdf,sys; print(len(pymupdf.open(sys.argv[1])))', filePath],
        { encoding: 'utf8' }
      ).trim()
    );
    assert(pageCount > 0, `PDF has no pages: ${filePath}`);
    return;
  }

  assert(content.subarray(0, 2).equals(Buffer.from('PK')), `Invalid XLSX header: ${filePath}`);
  const xlsxCheck = [
    'import sys,zipfile',
    'archive=zipfile.ZipFile(sys.argv[1])',
    'names=set(archive.namelist())',
    "assert '[Content_Types].xml' in names and 'xl/workbook.xml' in names",
    "assert any(name.startswith('xl/worksheets/') for name in names)",
    'archive.close()',
  ].join(';');
  execFileSync('python', ['-c', xlsxCheck, filePath], { stdio: 'pipe' });
}

async function waitForDownloads(downloads, count, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (downloads.length < count && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.strictEqual(
    downloads.length,
    count,
    `Expected ${count} downloads, received ${downloads.length}`
  );
}

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

    // Capturar descargas XLSX (disparadas por XLSX.writeFile).
    // Guardar una copia estable permite validar el archivo real, no sólo el Blob.
    const downloads = {};
    page.on('download', async (download) => {
      const name = download.suggestedFilename();
      const dlPath = await download.path();
      if (dlPath) {
        downloads[name] = fs.readFileSync(dlPath);
      }
    });

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
          // Disparar descarga XLSX (capturada por page.on('download') en Node)
          window.generarXLSXReporte(type, range.inicio, range);
          return { csv, pdf: pdf.output('datauristring') };
        },
        { type, range }
      );
      // Esperar a que llegue la descarga XLSX (máximo 3s)
      await new Promise((r) => setTimeout(r, 1200));

      const csvPath = path.join(output, `audit_${type}.csv`);
      const pdfPath = path.join(output, `audit_${type}.pdf`);
      fs.writeFileSync(csvPath, artifact.csv, 'utf8');
      fs.writeFileSync(pdfPath, Buffer.from(artifact.pdf.split(',')[1], 'base64'));
      assertStoredFile(csvPath, 'CSV');
      assertStoredFile(pdfPath, 'PDF');

      const entry = {
        type,
        csvPath,
        pdfPath,
        csvBytes: fs.statSync(csvPath).size,
        pdfBytes: fs.statSync(pdfPath).size,
      };

      // Buscar el archivo XLSX descargado (nombre comienza con reporte_${tipo}_)
      const xlsxName = Object.keys(downloads).find(
        (n) => n.startsWith(`reporte_${type}_`) && n.endsWith('.xlsx')
      );
      if (xlsxName && downloads[xlsxName]) {
        const xlsxPath = path.join(output, `audit_${type}.xlsx`);
        fs.writeFileSync(xlsxPath, downloads[xlsxName]);
        assertStoredFile(xlsxPath, 'XLSX');
        entry.xlsxPath = xlsxPath;
        entry.xlsxBytes = downloads[xlsxName].length;
        delete downloads[xlsxName];
      } else {
        assert.fail(`XLSX download was not received for report type: ${type}`);
      }
      manifest.push(entry);
    }

    // Ejercita el flujo de la interfaz que el usuario usa: tres descargas
    // independientes, persistidas en disco por Playwright y reabiertas.
    const uiDownloads = [];
    page.on('download', (download) => uiDownloads.push(download));
    await page.evaluate(() => {
      document.getElementById('reporte-tipo').value = 'diario';
      document.getElementById('reporte-fecha').value = '2026-10-17';
      document.getElementById('export-pdf').checked = true;
      document.getElementById('export-csv').checked = true;
      document.getElementById('export-xlsx').checked = true;
      window.generarReporteLocal();
    });
    await waitForDownloads(uiDownloads, 3);

    const uiOutput = path.join(output, 'ui-downloads');
    fs.mkdirSync(uiOutput, { recursive: true });
    for (const download of uiDownloads) {
      const filename = download.suggestedFilename();
      const savedPath = path.join(uiOutput, filename);
      await download.saveAs(savedPath);
      const format = filename.endsWith('.pdf')
        ? 'PDF'
        : filename.endsWith('.xlsx')
          ? 'XLSX'
          : 'CSV';
      assertStoredFile(savedPath, format);
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

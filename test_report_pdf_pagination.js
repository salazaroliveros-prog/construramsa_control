'use strict';

/* Verifica que el PDF agregue hojas sólo cuando el contenido lo requiera:
 * un reporte corto debe ocupar una hoja y uno extenso debe paginarse sin
 * generar páginas vacías ni perder el pie de página. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync, spawn } = require('child_process');
const { chromium } = require('playwright');

const port = 8155;
const base = `http://127.0.0.1:${port}/`;
const output = path.join(__dirname, 'temp_pdf_pagination');
const reportDate = '2035-01-01';
const datasets = [
  { name: 'corto', rows: 1, longText: false },
  { name: 'medio', rows: 25, longText: true },
  { name: 'extenso', rows: 80, longText: true },
];

function waitForServer(timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
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
    const retry = () => {
      if (Date.now() >= deadline) reject(new Error(`Servidor no disponible en ${port}`));
      else setTimeout(check, 150);
    };
    check();
  });
}

function analyzePdfs(pdfPaths) {
  const python = [
    'import json,pymupdf,numpy as np,sys',
    'result={}',
    'for pdf_path in sys.argv[1:]:',
    ' doc=pymupdf.open(pdf_path)',
    ' pages=[]',
    ' for page in doc:',
    '  pix=page.get_pixmap(dpi=72)',
    '  image=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width,pix.n)[:,:,:3]',
    '  gray=image.min(axis=2)',
    '  content=int((gray[:max(1,pix.height-60)]<245).sum())',
    '  footer=int((gray[pix.height-45:]<245).sum())',
    '  pages.append({"contentPixels":content,"footerPixels":footer})',
    ' result[pdf_path]=pages',
    'print(json.dumps(result))',
  ].join('\n');
  return JSON.parse(
    execFileSync('python', ['-c', python, ...pdfPaths], { encoding: 'utf8' }).trim()
  );
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

    const artifacts = [];
    for (const dataset of datasets) {
      const pdfBase64 = await page.evaluate(
        async ({ reportDate, dataset }) => {
          const db = window.getDB();
          const projectData = db.proyectos_data[db.configuracion.proyecto_actual];
          projectData.caja_chica = Array.from({ length: dataset.rows }, (_, index) => ({
            id: `paginacion-${dataset.name}-${index}`,
            tipo: 'egreso',
            fecha: reportDate,
            monto: 100 + index,
            categoria: 'materiales',
            descripcion: dataset.longText
              ? `Movimiento de prueba de paginación ${index + 1} con descripción extensa para validar el crecimiento vertical del reporte`
              : 'Compra menor',
          }));
          const html = window.generarHTMLReporte('diario', reportDate, {
            inicio: reportDate,
            fin: reportDate,
          });
          const container = window.prepararContenedorImpresion(`Paginación ${dataset.name}`, html);
          const pdf = await window.generarPDFPlantilla(container, `paginacion_${dataset.name}.pdf`);
          return pdf.output('datauristring');
        },
        { reportDate, dataset }
      );
      const pdfPath = path.join(output, `paginacion_${dataset.name}.pdf`);
      fs.writeFileSync(pdfPath, Buffer.from(pdfBase64.split(',')[1], 'base64'));
      assert(fs.statSync(pdfPath).size > 1000, `PDF vacío: ${pdfPath}`);
      artifacts.push({ ...dataset, pdfPath });
    }

    const analysis = analyzePdfs(artifacts.map((artifact) => artifact.pdfPath));
    for (const artifact of artifacts) {
      const pages = analysis[artifact.pdfPath];
      artifact.pages = pages.length;
      assert(pages.length > 0, `${artifact.name}: PDF sin páginas`);
      pages.forEach((pageInfo, index) => {
        assert(
          pageInfo.contentPixels > 100,
          `${artifact.name}: página ${index + 1} no tiene contenido`
        );
        assert(
          pageInfo.footerPixels > 0,
          `${artifact.name}: página ${index + 1} no tiene pie de página`
        );
      });
    }

    const [short, medium, long] = artifacts;
    assert.strictEqual(
      short.pages,
      1,
      `un reporte corto debe ocupar una hoja (obtuvo ${short.pages})`
    );
    assert(medium.pages > short.pages, `el reporte medio no paginó (${medium.pages} hojas)`);
    assert(long.pages > medium.pages, `el reporte extenso no creció (${long.pages} hojas)`);

    console.log(
      JSON.stringify(
        artifacts.map(({ name, rows, pages }) => ({ name, rows, pages })),
        null,
        2
      )
    );
    console.log('Report PDF pagination tests OK');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

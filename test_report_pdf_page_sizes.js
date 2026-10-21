'use strict';

/* Verifica que el PDF respete el tamaño de hoja elegido (Letter, Oficio, A4 y
 * Legal), mantenga márgenes imprimibles y adapte automáticamente la cantidad
 * de filas por hoja. También comprueba que el resultado sea idéntico en móvil:
 * la captura usa un ancho fijo de 186 mm, no el viewport. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync, spawn } = require('child_process');
const { chromium } = require('playwright');

const port = 8156;
const base = `http://127.0.0.1:${port}/`;
const output = path.join(__dirname, 'temp_pdf_page_sizes');
const reportDate = '2036-02-02';
const rows = 55;
const expected = {
  letter: { width: 612, height: 792 },
  oficio: { width: 612, height: 936 },
  a4: { width: 595, height: 842 },
  legal: { width: 612, height: 1009 },
};

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
    '  body=gray[:max(1,pix.height-60)]',
    '  ys,xs=np.where(body<245)',
    '  pages.append({',
    '   "width":pix.width,"height":pix.height,',
    '   "contentPixels":int((body<245).sum()),',
    '   "footerPixels":int((gray[pix.height-45:]<245).sum()),',
    '   "left":int(xs.min()) if len(xs) else -1,',
    '   "right":int(xs.max()) if len(xs) else -1,',
    '   "top":int(ys.min()) if len(ys) else -1,',
    '   "bottom":int(ys.max()) if len(ys) else -1',
    '  })',
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

    const scenarios = [
      { name: 'letter-desktop', pageSize: 'letter', viewport: { width: 1366, height: 900 } },
      { name: 'oficio-desktop', pageSize: 'oficio', viewport: { width: 1366, height: 900 } },
      { name: 'a4-desktop', pageSize: 'a4', viewport: { width: 1366, height: 900 } },
      { name: 'legal-desktop', pageSize: 'legal', viewport: { width: 1366, height: 900 } },
      { name: 'letter-mobile', pageSize: 'letter', viewport: { width: 390, height: 844 } },
    ];

    const artifacts = [];
    for (const scenario of scenarios) {
      const page = await browser.newPage({ viewport: scenario.viewport });
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.evaluate(
        (db) => localStorage.setItem('construramsa_db', JSON.stringify(db)),
        seed
      );
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const pdfBase64 = await page.evaluate(
        async ({ reportDate, rows, pageSize }) => {
          document.getElementById('vp-page-size').value = pageSize;
          const db = window.getDB();
          const projectData = db.proyectos_data[db.configuracion.proyecto_actual];
          projectData.caja_chica = Array.from({ length: rows }, (_, index) => ({
            id: `page-size-${pageSize}-${index}`,
            tipo: 'egreso',
            fecha: reportDate,
            monto: 125 + index,
            categoria: 'materiales',
            descripcion: `Movimiento de prueba ${index + 1} con descripción extensa para validar el ajuste automático de filas por hoja`,
          }));
          const range = { inicio: reportDate, fin: reportDate };
          const html = window.generarHTMLReporte('diario', reportDate, range);
          const container = window.prepararContenedorImpresion('Prueba de tamaños', html);
          const pdf = await window.generarPDFPlantilla(container, `${pageSize}.pdf`);
          return pdf.output('datauristring');
        },
        { reportDate, rows, pageSize: scenario.pageSize }
      );
      const pdfPath = path.join(output, `${scenario.name}.pdf`);
      fs.writeFileSync(pdfPath, Buffer.from(pdfBase64.split(',')[1], 'base64'));
      assert(fs.statSync(pdfPath).size > 1000, `PDF vacío: ${pdfPath}`);
      artifacts.push({ ...scenario, pdfPath });
      await page.close();
    }

    const analysis = analyzePdfs(artifacts.map((artifact) => artifact.pdfPath));
    const pagesBySize = {};
    for (const artifact of artifacts) {
      const pages = analysis[artifact.pdfPath];
      const size = expected[artifact.pageSize];
      assert(pages.length > 1, `${artifact.name}: se esperaban varias páginas`);
      pages.forEach((info, index) => {
        assert(
          Math.abs(info.width - size.width) <= 2 && Math.abs(info.height - size.height) <= 2,
          `${artifact.name}: página ${index + 1} mide ${info.width}x${info.height}pt, se esperaba ${size.width}x${size.height}pt`
        );
        assert(
          info.contentPixels > 100,
          `${artifact.name}: página ${index + 1} no tiene contenido`
        );
        assert(
          info.footerPixels > 0,
          `${artifact.name}: página ${index + 1} no tiene pie de página`
        );
        assert(info.left >= 20, `${artifact.name}: margen izquierdo insuficiente (${info.left}pt)`);
        assert(
          info.right >= info.width - 55 && info.right <= info.width - 20,
          `${artifact.name}: contenido fuera del área imprimible (${info.right}/${info.width}pt)`
        );
        assert(info.top >= 10, `${artifact.name}: margen superior insuficiente (${info.top}pt)`);
        assert(
          info.bottom <= info.height - 55,
          `${artifact.name}: contenido invade el pie de página (${info.bottom}/${info.height}pt)`
        );
      });
      pagesBySize[artifact.name] = pages.length;
    }

    assert(
      pagesBySize['oficio-desktop'] <= pagesBySize['letter-desktop'],
      `Oficio debe aprovechar más la altura que Letter (${pagesBySize['oficio-desktop']} > ${pagesBySize['letter-desktop']})`
    );
    assert(
      pagesBySize['legal-desktop'] <= pagesBySize['oficio-desktop'],
      `Legal debe aprovechar más la altura que Oficio (${pagesBySize['legal-desktop']} > ${pagesBySize['oficio-desktop']})`
    );
    assert.strictEqual(
      pagesBySize['letter-mobile'],
      pagesBySize['letter-desktop'],
      'El PDF móvil debe paginar igual que el de escritorio al usar ancho fijo'
    );

    console.log(JSON.stringify(pagesBySize, null, 2));
    console.log('Report PDF page size tests OK');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');

const port = 8091;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForServer(url, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, response => { response.resume(); response.statusCode < 500 ? resolve() : reject(new Error('HTTP ' + response.statusCode)); });
        req.on('error', reject);
        req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return;
    } catch { await wait(150); }
  }
  throw new Error(`Servidor no disponible en ${url}`);
}

(async () => {
  const server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port), NODE_OPTIONS: '' },
    stdio: 'ignore'
  });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    await waitForServer(`http://127.0.0.1:${port}/`);
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });

    const modules = await page.locator('.nav-tab').count();
    if (modules !== 9) throw new Error(`Se esperaban 9 módulos y se encontraron ${modules}`);

    for (const tab of await page.locator('.nav-tab').all()) {
      await tab.click();
      if (!(await tab.getAttribute('aria-current'))) throw new Error('La navegación no actualizó aria-current');
    }

    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('[data-module="configuracion"]');
    await page.click('button[onclick="mostrarModalCrearProyecto()"]');
    await page.fill('#proyecto-nombre', 'Proyecto Smoke');
    await page.fill('#proyecto-presupuesto', '1000');
    await page.click('button[onclick="crearProyectoDesdeModal()"]');
    await page.click('[data-module="caja-chica"]');
    const today = new Date().toISOString().slice(0, 10);
    await page.fill('#caja-fecha', today);
    await page.selectOption('#caja-tipo', 'ingreso');
    await page.fill('#caja-descripcion', 'Apertura smoke');
    await page.fill('#caja-monto', '500');
    await page.click('#form-caja-chica button[type="submit"]');
    await page.fill('#caja-fecha', today);
    await page.selectOption('#caja-tipo', 'egreso');
    await page.selectOption('#caja-categoria', 'materiales');
    await page.fill('#caja-descripcion', 'Compra smoke');
    await page.fill('#caja-monto', '100');
    await page.click('#form-caja-chica button[type="submit"]');

    const result = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const data = db.proyectos_data[db.configuracion.proyecto_actual];
      return { movements: data.caja_chica.length, balance: document.querySelector('#saldo-caja-chica').textContent };
    });
    if (result.movements !== 2 || !result.balance.includes('1,400')) throw new Error(`Saldo inesperado: ${JSON.stringify(result)}`);

    await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const data = db.proyectos_data[db.configuracion.proyecto_actual];
      data.caja_chica[0].descripcion = '<img src=x onerror=alert(1)>, "prueba"\nsegunda línea';
      localStorage.setItem('construramsa_db', JSON.stringify(db));
    });
    await page.reload({ waitUntil: 'networkidle' });
    if (await page.locator('#tabla-caja-chica-cuerpo img').count()) throw new Error('La tabla permitió HTML no escapado');
    const csv = await page.evaluate(date => generarCSVReporte('diario', date), today);
    if (!csv.includes('""prueba""')) throw new Error('El CSV no escapó comillas correctamente');
    if (csv.includes('onerror=alert(1)>\nsegunda línea')) throw new Error('El CSV dejó un salto de línea sin encapsular');
    const formulaSafe = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const data = db.proyectos_data[db.configuracion.proyecto_actual];
      data.caja_chica[0].descripcion = '=HYPERLINK("https://example.com")';
      localStorage.setItem('construramsa_db', JSON.stringify(db));
      invalidarCacheDB();
      return generarCSVReporte('diario', new Date().toISOString().slice(0, 10));
    });
    if (!formulaSafe.includes('"\'=HYPERLINK')) throw new Error('El CSV no neutralizó una fórmula potencial');

    await page.click('[data-module="adquisiciones"]');
    await page.fill('#prov-nombre', 'Proveedor smoke');
    await page.fill('#prov-telefono', '55555555');
    await page.fill('#prov-especialidad', 'Materiales');
    await page.click('#form-proveedor button[type="submit"]');
    const providerId = await page.evaluate(() => JSON.parse(localStorage.getItem('construramsa_db')).proyectos_data[JSON.parse(localStorage.getItem('construramsa_db')).configuracion.proyecto_actual].adquisiciones.proveedores[0].id);
    await page.selectOption('#cot-proveedor', providerId);
    await page.fill('#cot-material', 'Cemento smoke');
    await page.fill('#cot-precio', '10');
    await page.fill('#cot-cantidad', '2');
    await page.click('#form-cotizacion button[type="submit"]');
    const quoteId = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return d.adquisiciones.cotizaciones_compras.find(x => x.material_descripcion === 'Cemento smoke').id; });
    await page.click(`button[onclick="aprobarCotizacion('${quoteId}')"]`);
    const approved = await page.evaluate(id => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; const q = d.adquisiciones.cotizaciones_compras.find(x => x.id === id); return { approved: q?.estado === 'aprobada', linked: !!q?.gasto_id, linkedExpense: d.caja_chica.some(x => x.id === q?.gasto_id) }; }, quoteId);
    if (!approved.approved || !approved.linked || !approved.linkedExpense) throw new Error(`Cotización sin vínculo contable: ${JSON.stringify(approved)}`);

    await page.click('[data-module="viajes"]');
    await page.fill('#cam-nombre', 'Camión inválido');
    await page.fill('#cam-capacidad', '0');
    await page.click('#form-camion button[type="submit"]');
    const invalidTruckCount = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      return db.proyectos_data[db.configuracion.proyecto_actual].viajes_camiones.camiones.length;
    });
    if (invalidTruckCount !== 0) throw new Error('Se guardó un camión con capacidad inválida');

    if (errors.length) throw new Error(errors.join('; '));
    console.log('Smoke tests OK:', JSON.stringify(result));
  } finally {
    await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error.message); process.exit(1); });

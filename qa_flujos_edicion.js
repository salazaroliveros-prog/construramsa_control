/** QA complementario: editar/eliminar viaje y cotización (flujos no cubiertos). */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const port = 8097;
const wait = ms => new Promise(r => setTimeout(r, ms));
const resultados = [];
const log = (m, a, ok, d = '') => { console.log(`${ok ? '✅' : '❌'} [${m}] ${a}${d ? ' — ' + d : ''}`); resultados.push({ m, a, ok }); };
async function waitForServer(url, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { await new Promise((res, rej) => { const rq = http.get(url, rs => { rs.resume(); rs.statusCode < 500 ? res() : rej(); }); rq.on('error', rej); rq.setTimeout(800, () => { rq.destroy(); rej(); }); }); return; }
    catch { await wait(120); }
  }
  throw new Error('Servidor no disponible');
}
async function confirmar(page) {
  await page.evaluate(() => { const ov = document.getElementById('modal-overlay'); const b = document.getElementById('modal-confirm'); if (ov && !ov.classList.contains('hidden') && b) b.click(); });
  await wait(300);
}
(async () => {
  const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), NODE_OPTIONS: '' }, stdio: 'ignore' });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(8000);
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  try {
    await waitForServer(`http://127.0.0.1:${port}/`);
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await wait(1200);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(1000);
    await page.click('[data-module="configuracion"]');
    await page.click('button[onclick="mostrarModalCrearProyecto()"]');
    await page.fill('#proyecto-nombre', 'Proyecto QA Flujos');
    await page.fill('#proyecto-presupuesto', '20000');
    await page.click('button[onclick="crearProyectoDesdeModal()"]');
    await wait(350);
    const hoy = new Date().toISOString().slice(0, 10);

    // Fondo para que el gasto del viaje tenga saldo
    await page.click('[data-module="caja-chica"]');
    await page.fill('#caja-fecha', hoy);
    await page.selectOption('#caja-tipo', 'ingreso');
    await page.fill('#caja-descripcion', 'Fondo');
    await page.fill('#caja-monto', '5000');
    await page.click('#form-caja-chica button[type="submit"]');
    await wait(250);

    // Viaje completo
    await page.click('[data-module="viajes"]');
    await wait(250);
    await page.fill('#cam-nombre', 'Camion QA Edit');
    await page.selectOption('#cam-propiedad', 'propio');
    await page.fill('#cam-consumo', '0.3');
    await page.click('#form-camion button[type="submit"]');
    await wait(250);
    await page.fill('#ruta-nombre', 'Ruta QA');
    await page.fill('#ruta-distancia', '12');
    await page.click('#form-ruta button[type="submit"]');
    await wait(250);
    const ids = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return { cam: d.viajes_camiones.camiones[0].id, ruta: d.viajes_camiones.rutas_botadero[0].id }; });
    await page.selectOption('#viaje-cam', ids.cam);
    await page.selectOption('#viaje-ruta', ids.ruta);
    await page.selectOption('#viaje-material', 'tierra');
    await page.fill('#viaje-numero', '3');
    await page.fill('#viaje-precio-diesel', '35');
    await page.click('#form-viaje button[type="submit"]');
    await wait(350);
    let via = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return d.viajes_camiones.viajes[0] || null; });
    log('Viajes', 'Viaje creado (numero=3)', !!via && via.numero === 3);

    // EDITAR viaje: 3 → 5
    await page.click(`button[onclick="editarViaje('${via.id}')"]`);
    await wait(250);
    await page.fill('#viaje-numero', '5');
    await page.click('#form-viaje button[type="submit"]');
    await wait(300);
    await confirmar(page);
    const editado = await page.evaluate(id => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; const v = d.viajes_camiones.viajes.find(x => x.id === id); return v ? v.numero : null; }, via.id);
    log('Viajes', 'Editar viaje (3→5)', editado === 5, `numero=${editado}`);

    // ELIMINAR viaje
    await page.click(`button[onclick="eliminarViaje('${via.id}')"]`);
    await wait(300);
    await confirmar(page);
    const eliminado = await page.evaluate(id => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return d.viajes_camiones.viajes.some(x => x.id === id); }, via.id);
    log('Viajes', 'Eliminar viaje', !eliminado);

    // Cotización: crear → editar → eliminar
    await page.click('[data-module="adquisiciones"]');
    await wait(250);
    await page.fill('#prov-nombre', 'Prov QA Edit');
    await page.fill('#prov-telefono', '55551111');
    await page.fill('#prov-especialidad', 'Herramientas');
    await page.click('#form-proveedor button[type="submit"]');
    await wait(250);
    const provId = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return d.adquisiciones.proveedores[0].id; });
    await page.selectOption('#cot-proveedor', provId);
    await page.fill('#cot-material', 'Clavos QA');
    await page.fill('#cot-precio', '10');
    await page.fill('#cot-cantidad', '100');
    await page.click('#form-cotizacion button[type="submit"]');
    await wait(300);
    const cot = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return d.adquisiciones.cotizaciones_compras[0] || null; });
    log('Adquisiciones', 'Cotización creada', !!cot);
    await page.click(`button[onclick="editarCotizacion('${cot.id}')"]`);
    await wait(250);
    await page.fill('#cot-precio', '12');
    await page.click('#form-cotizacion button[type="submit"]');
    await wait(300);
    await confirmar(page);
    const cotEdit = await page.evaluate(id => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; const q = d.adquisiciones.cotizaciones_compras.find(x => x.id === id); return q ? (q.precio_unitario ?? q.precio) : null; }, cot.id);
    log('Adquisiciones', 'Editar cotización (10→12)', cotEdit == 12, `precio=${cotEdit}`);
    // Diseño de la app: pendiente → solo Editar/Aprobar/Rechazar; Eliminar aparece tras rechazar/aprobar.
    await page.click(`button[onclick="rechazarCotizacion('${cot.id}')"]`);
    await wait(300);
    await confirmar(page);
    await page.click(`button[onclick="eliminarCotizacion('${cot.id}')"]`);
    await wait(300);
    await confirmar(page);
    const cotElim = await page.evaluate(id => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return d.adquisiciones.cotizaciones_compras.some(x => x.id === id); }, cot.id);
    log('Adquisiciones', 'Eliminar cotización', !cotElim);

    const filtrados = jsErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('service-worker') && !e.includes('Failed to fetch'));
    log('JavaScript', 'Sin errores de consola', filtrados.length === 0, filtrados.slice(0, 3).join(' | ').substring(0, 120));
  } catch (err) {
    log('Fatal', err.message.split('\n')[0], false);
  } finally {
    await browser.close();
    server.kill();
    const ok = resultados.filter(r => r.ok).length, fail = resultados.filter(r => !r.ok).length;
    console.log(`\n══ RESUMEN QA-FLOWS ══\n✅ ${ok}  ❌ ${fail}`);
    process.exitCode = fail > 0 ? 1 : 0;
  }
})();

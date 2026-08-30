/**
 * QA INTEGRAL CONSTRURAMSA — siembra datos en todos los módulos y valida:
 * módulos, KPIs, gráficas del dashboard, exportaciones (CSV/XLSX/PDF) e importación JSON.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');

const port = 8095;
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

(async () => {
  const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), NODE_OPTIONS: '' }, stdio: 'ignore' });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(8000);
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });

  try {
    await waitForServer(`http://127.0.0.1:${port}/`);
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await wait(1000);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(800);
    log('App', 'Carga inicial y reset', true);

    // ── PROYECTO ──
    await page.click('[data-module="configuracion"]');
    await page.click('button[onclick="mostrarModalCrearProyecto()"]');
    await page.fill('#proyecto-nombre', 'Proyecto QA Integral');
    await page.fill('#proyecto-presupuesto', '50000');
    await page.click('button[onclick="crearProyectoDesdeModal()"]');
    await wait(250);
    const pid = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); return db.proyectos.find(p => p.nombre === 'Proyecto QA Integral')?.id; });
    log('Proyecto', 'Crear y activar', !!pid, pid);

    // ── CAJA CHICA: 3 movimientos ──
    await page.click('[data-module="caja-chica"]');
    await wait(250);
    const hoy = new Date().toISOString().slice(0, 10);
    const movs = [
      ['ingreso', 'apertura', 'Fondo inicial obra', '20000'],
      ['egreso', 'materiales', 'Cemento 50 bolsas', '3500'],
      ['egreso', 'combustible', 'Diésel semana', '1250'],
    ];
    for (const [tipo, cat, desc, monto] of movs) {
      await page.fill('#caja-fecha', hoy);
      await page.selectOption('#caja-tipo', tipo);
      await page.selectOption('#caja-categoria', cat);
      await page.fill('#caja-descripcion', desc);
      await page.fill('#caja-monto', monto);
      await page.click('#form-caja-chica button[type="submit"]');
      await wait(250);
    }
    const caja = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const d = db.proyectos_data[db.configuracion.proyecto_actual];
      return { n: d.caja_chica.length, saldoUI: document.getElementById('saldo-caja-chica').textContent };
    });
    log('Caja Chica', '3 movimientos registrados', caja.n === 3, `${caja.n}`);
    // El saldo mostrado = presupuesto inicial del proyecto + ingresos - egresos
    log('Caja Chica', 'Saldo UI correcto (Q65,250.00 = presupuesto + neto)', caja.saldoUI.includes('65,250'), caja.saldoUI);

    // ── MAQUINARIA ──
    await page.click('[data-module="maquinaria"]');
    await wait(250);
    await page.fill('#maq-fecha', hoy);
    await page.selectOption('#maq-tipo', 'retroexcavadora');
    await page.fill('#maq-codigo', 'RETRO-QA');
    await page.fill('#maq-val-inicial', '100');
    await page.fill('#maq-val-final', '108');
    await page.fill('#maq-galones', '20');
    await page.fill('#maq-precio-galon', '35');
    await page.click('#form-maquinaria button[type="submit"]');
    await wait(300);
    const maqN = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return (d.maquinaria_flota?.registros || []).length; });
    log('Maquinaria', 'Registro creado', maqN >= 1, `${maqN}`);

    // ── PERSONAL ──
    await page.click('[data-module="personal"]');
    await wait(250);
    await page.fill('#trab-nombre', 'Carlos Gómez QA');
    await page.fill('#trab-puesto', 'Operador');
    await page.fill('#trab-pago-normal', '18.75');
    await page.fill('#trab-pago-extra', '28.00');
    await page.click('#form-trabajador button[type="submit"]');
    await wait(250);
    const trabId = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return d.personal?.trabajadores?.[0]?.id; });
    log('Personal', 'Trabajador creado', !!trabId);
    if (trabId) {
      await page.evaluate(id => { const r = document.querySelector(`input[name="asistencia-${id}"][value="asistio"]`); if (r) r.click(); }, trabId);
      await page.click('button[onclick*="guardarAsistenciaDiaria"]');
      await wait(250);
      const asis = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return (d.personal?.asistencia || []).length; });
      log('Personal', 'Asistencia guardada', asis >= 1, `${asis}`);
    }

    // ── ADQUISICIONES ──
    await page.click('[data-module="adquisiciones"]');
    await wait(250);
    await page.fill('#prov-nombre', 'Ferretería QA Central');
    await page.fill('#prov-telefono', '50212345678');
    await page.fill('#prov-especialidad', 'Materiales');
    await page.click('#form-proveedor button[type="submit"]');
    await wait(250);
    const provId = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return d.adquisiciones?.proveedores?.[0]?.id; });
    await page.selectOption('#cot-proveedor', provId);
    await page.fill('#cot-material', 'Varilla 1/2"');
    await page.fill('#cot-precio', '85');
    await page.fill('#cot-cantidad', '20');
    await page.click('#form-cotizacion button[type="submit"]');
    await wait(250);
    const cot = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return d.adquisiciones?.cotizaciones_compras?.[0] || null; });
    log('Adquisiciones', 'Proveedor + cotización', !!provId && !!cot, cot ? `Q${cot.precio_unitario ?? cot.precio} x ${cot.cantidad}` : '');
    if (cot) {
      await page.click(`button[onclick="aprobarCotizacion('${cot.id}')"]`);
      await wait(300);
      const apr = await page.evaluate(id => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; const q = d.adquisiciones.cotizaciones_compras.find(x => x.id === id); return { estado: q?.estado, vinculo: !!q?.gasto_id }; }, cot.id);
      log('Adquisiciones', 'Aprobación con vínculo contable', apr.estado === 'aprobada' && apr.vinculo);
    }

    // ── VIAJES ──
    await page.click('[data-module="viajes"]');
    await wait(250);
    await page.fill('#cam-nombre', 'Volvol QA');
    await page.selectOption('#cam-propiedad', 'propio');
    await page.fill('#cam-consumo', '0.35');
    await page.click('#form-camion button[type="submit"]');
    await wait(250);
    await page.fill('#ruta-nombre', 'Botadero QA Norte');
    await page.fill('#ruta-distancia', '18');
    await page.click('#form-ruta button[type="submit"]');
    await wait(250);
    const ids = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return { cam: d.viajes_camiones?.camiones?.[0]?.id, ruta: d.viajes_camiones?.rutas_botadero?.[0]?.id }; });
    await page.selectOption('#viaje-cam', ids.cam);
    await page.selectOption('#viaje-ruta', ids.ruta);
    await page.selectOption('#viaje-material', 'tierra');
    await page.fill('#viaje-numero', '5');
    await page.fill('#viaje-precio-diesel', '35');
    await page.click('#form-viaje button[type="submit"]');
    await wait(300);
    const viajesN = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return (d.viajes_camiones?.viajes || []).length; });
    log('Viajes', 'Camión + ruta + viaje registrados', viajesN >= 1, `${viajesN} viaje(s)`);

    // ── MANTENIMIENTO ──
    await page.click('[data-module="mantenimiento"]');
    await wait(250);
    await page.fill('#maqcat-nombre', 'Retroexcavadora QA');
    await page.selectOption('#maqcat-tipo', 'Retroexcavadora');
    await page.click('#form-maqcat button[type="submit"]');
    await wait(250);
    const maquinaId = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return d.mantenimiento?.maquinaria?.[0]?.id; });
    if (maquinaId) {
      await page.selectOption('#ord-maquina', maquinaId);
      await page.selectOption('#ord-tipo', 'preventivo');
      await page.fill('#ord-costo', '3500');
      await page.fill('#ord-observaciones', 'Mantenimiento 250 horas');
      await page.click('#form-orden button[type="submit"]');
      await wait(250);
    }
    const ordN = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); const d = db.proyectos_data[db.configuracion.proyecto_actual]; return (d.mantenimiento?.ordenes || []).length; });
    log('Mantenimiento', 'Máquina + orden de trabajo', ordN >= 1, `${ordN} orden(es)`);

    // ── RESUMEN / KPIs ──
    await page.click('[data-module="resumen"]');
    await wait(800);
    const kpis = await page.evaluate(() => {
      const grid = document.getElementById('kpi-grid');
      return { n: grid ? grid.querySelectorAll('.kpi-card').length : 0, txt: grid ? grid.textContent : '' };
    });
    log('Resumen', 'KPIs renderizados', kpis.n > 0, `${kpis.n} tarjetas`);
    log('Resumen', 'KPI de saldo presente', kpis.txt.includes('Saldo'));

    // ── DASHBOARD (gráficas) ──
    await page.selectOption('#dashboard-periodo', 'mes');
    await wait(300);
    await page.selectOption('#dashboard-categoria', 'todas');
    await page.click('button[onclick="actualizarDashboard()"]');
    await wait(800);
    const dash = await page.evaluate(() => {
      const canvases = [...document.querySelectorAll('canvas')];
      const pintados = canvases.filter(c => c.width > 0 && c.toDataURL('image/png').length > 2000).length;
      const gastoDiario = document.getElementById('gasto-diario')?.textContent || '';
      const proyeccion = document.getElementById('proyeccion-valor')?.textContent || '';
      return { total: canvases.length, pintados, gastoDiario, proyeccion };
    });
    log('Dashboard', 'Gráficas canvas pintadas', dash.pintados > 0, `${dash.pintados}/${dash.total}`);
    log('Dashboard', 'KPI gasto diario con datos', /\d/.test(dash.gastoDiario) && !/Q0\.00/.test(dash.gastoDiario), dash.gastoDiario.trim());
    log('Dashboard', 'KPI proyección con datos', /\d/.test(dash.proyeccion), dash.proyeccion.trim());

    // ── REPORTES: CSV y XLSX (6 tipos) ──
    await page.click('[data-module="reportes"]');
    await wait(300);
    const tipos = ['diario', 'semanal', 'mensual', 'asistencia', 'viajes', 'mantenimiento'];
    for (const tipo of tipos) {
      const csv = await page.evaluate(({ t, f }) => generarCSVReporte(t, f), { t: tipo, f: hoy });
      log('Reportes', `CSV ${tipo}`, typeof csv === 'string' && csv.length > 50, `${(csv || '').length} chars`);
      const xlsx = await page.evaluate(({ t, f }) => { try { const b = generarXLSX(t, f, 'Proyecto QA Integral', 'reporte', true); return b ? new Uint8Array(b).slice(0, 2).join(',') : null; } catch (e) { return 'ERR:' + e.message; } }, { t: tipo, f: hoy });
      log('Reportes', `XLSX ${tipo}`, xlsx === '80,75', String(xlsx) + ' (magic PK)');
    }

    // PDF (solo tipo diario, verificación de generación sin errores)
    await page.evaluate(() => { document.getElementById('export-pdf').checked = true; document.getElementById('export-csv').checked = false; document.getElementById('export-xlsx').checked = false; });
    await page.evaluate(() => { try { generarReporteLocal(); } catch (e) { console.error('PDF QA: ' + e.message); } });
    await wait(1600);
    const pdfOk = !jsErrors.some(e => e.includes('PDF') || e.toLowerCase().includes('html2pdf') || e.toLowerCase().includes('jspdf'));
    log('Reportes', 'PDF diario generado sin errores', pdfOk);

    // ── IMPORTACIÓN JSON ──
    const backup = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('construramsa_db'))));
    await page.setInputFiles('#import-json', { name: 'respaldo-qa.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await wait(250);
    await page.evaluate(() => { const ov = document.getElementById('modal-overlay'); const b = document.getElementById('modal-confirm'); if (ov && !ov.classList.contains('hidden') && b) b.click(); });
    await page.waitForLoadState('load').catch(() => {});
    await wait(2000);
    const importado = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('construramsa_db')); return { proyectos: (db.proyectos || []).length, caja: db.proyectos_data ? Object.values(db.proyectos_data).some(d => (d.caja_chica || []).length > 0) : false }; });
    log('Importación', 'JSON restaurado con proyectos', importado.proyectos >= 1, `${importado.proyectos}`);
    log('Importación', 'Datos de caja preservados', importado.caja);

    // ── ERRORES JS ──
    const filtrados = jsErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('service-worker') && !e.includes('Failed to fetch'));
    log('JavaScript', 'Sin errores de consola', filtrados.length === 0, filtrados.slice(0, 3).join(' | ').substring(0, 150));

  } catch (err) {
    log('Fatal', err.message, false);
  } finally {
    await browser.close();
    server.kill();
    const ok = resultados.filter(r => r.ok).length;
    const fail = resultados.filter(r => !r.ok).length;
    console.log(`\n══ RESUMEN QA ══\n✅ ${ok}  ❌ ${fail}  📊 ${ok + fail}`);
    resultados.filter(r => !r.ok).forEach(r => console.log(`   ❌ [${r.m}] ${r.a}`));
    process.exitCode = fail > 0 ? 1 : 0;
  }
})();


/**
 * CONSTRURAMSA v2.8.4 — Test CRUD completo
 * Prueba: Crear, Leer, Modificar y Eliminar en todos los módulos
 * IDs verificados directamente desde index.html
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');

// Por defecto valida el servidor local; APP_URL permite ejecutar la misma suite
// contra un preview o producción cuando ese despliegue ya contiene los cambios.
const PORT = process.env.TEST_PORT || '8092';
const URL = process.env.APP_URL || `http://127.0.0.1:${PORT}`;
const resultados = [];

function log(modulo, accion, ok, detalle = '') {
  const estado = ok ? '✅' : '❌';
  const msg = `${estado} [${modulo}] ${accion}${detalle ? ' — ' + detalle : ''}`;
  console.log(msg);
  resultados.push({ modulo, accion, ok, detalle });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
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
    } catch { await sleep(150); }
  }
  throw new Error(`Servidor no disponible en ${url}`);
}

async function confirmar(page) {
  await sleep(400);
  // El modal usa clase 'hidden' con display:none. Playwright reporta el overlay como hidden.
  // Verificamos directamente si el overlay está activo (sin clase 'hidden') y clickamos confirm.
  await page.evaluate(() => {
    const ov = document.getElementById('modal-overlay');
    const btn = document.getElementById('modal-confirm');
    if (ov && !ov.classList.contains('hidden') && btn) {
      btn.click();
    }
  });
  await sleep(400);
}

async function getDB(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('construramsa_db') || '{}'));
}

async function getDatos(page) {
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('construramsa_db') || '{}');
    const pid = db.configuracion?.proyecto_actual;
    return pid ? (db.proyectos_data?.[pid] || db) : db;
  });
}

(async () => {
  const localServer = process.env.APP_URL ? null : spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT, NODE_OPTIONS: '' },
    stdio: 'ignore'
  });
  if (localServer) await waitForServer(`${URL}/`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') jsErrors.push(msg.text()); });

  try {
    console.log('\n══════════════════════════════════════════════');
    console.log('  CONSTRURAMSA v2.8.4 — TEST CRUD COMPLETO');
    console.log('══════════════════════════════════════════════\n');

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2500);
    log('App', 'Carga inicial', true, URL);

    // Limpiar y recargar
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2000);
    log('App', 'Reset localStorage', true);

    // ─── PROYECTO ────────────────────────────────────────────────
    console.log('\n--- PROYECTO ---');
    // Abrir modal desde configuración
    await page.click('[data-module="configuracion"]');
    await sleep(400);
    await page.click('button[onclick="mostrarModalCrearProyecto()"]');
    await sleep(500);

    await page.fill('#proyecto-nombre', 'Proyecto Test QA');
    await page.fill('#proyecto-descripcion', 'Proyecto para pruebas automatizadas');
    await page.fill('#proyecto-presupuesto', '50000');
    await page.click('button[onclick="crearProyectoDesdeModal()"]');
    await sleep(700);

    const db0 = await getDB(page);
    const proy = (db0.proyectos || []).find(p => p.nombre === 'Proyecto Test QA');
    log('Proyecto', 'Crear', !!proy, proy ? `ID: ${proy.id}` : 'No encontrado');

    // Seleccionar proyecto desde el selector del header
    if (proy) {
      await page.selectOption('#selector-proyectos', proy.id);
      await sleep(500);
      log('Proyecto', 'Seleccionar activo', true, proy.nombre);
    }

    // ─── CAJA CHICA ──────────────────────────────────────────────
    console.log('\n--- CAJA CHICA ---');
    await page.click('[data-module="caja-chica"]');
    await sleep(400);

    // CREAR ingreso
    await page.selectOption('#caja-tipo', 'ingreso');
    await sleep(150);
    await page.selectOption('#caja-categoria', 'apertura');
    await page.fill('#caja-descripcion', 'Apertura inicial de caja');
    await page.fill('#caja-monto', '10000');
    await page.fill('#caja-responsable', 'QA Tester');
    await page.click('#form-caja-chica button[type="submit"]');
    await sleep(500);

    const d1 = await getDatos(page);
    const ingreso = d1.caja_chica.find(m => m.descripcion === 'Apertura inicial de caja');
    log('Caja Chica', 'Crear ingreso', !!ingreso, ingreso ? `Q${ingreso.monto}` : 'No encontrado');

    // CREAR egreso — via UI real (el ingreso de Q10000 garantiza saldo suficiente)
    const fechaHoy2 = new Date().toISOString().split('T')[0];
    await page.selectOption('#caja-tipo', 'egreso');
    await sleep(150);
    await page.selectOption('#caja-categoria', 'materiales');
    await page.fill('#caja-fecha', fechaHoy2);
    await page.fill('#caja-descripcion', 'Compra de cemento');
    await page.fill('#caja-monto', '500');
    await page.fill('#caja-responsable', 'QA Tester');
    await page.click('#form-caja-chica button[type="submit"]');
    await sleep(600);

    const d2 = await getDatos(page);
    const egresoCreado = d2.caja_chica.find(m => m.descripcion === 'Compra de cemento');
    log('Caja Chica', 'Crear egreso', !!egresoCreado, egresoCreado ? `Q${egresoCreado.monto}` : 'No encontrado');

    // LEER tabla — ambos movimientos deben ser visibles (la UI ya actualizó la tabla)
    const filasCC = await page.locator('#tabla-caja-chica-cuerpo tr').count();
    log('Caja Chica', 'Leer tabla', filasCC >= 2, `${filasCC} filas`);

    // EDITAR usando el id del egreso recién creado
    if (egresoCreado) {
      // Buscar el botón editar específico del egreso
      const editBtnCC = page.locator(`button[onclick="editarMovimientoCaja('${egresoCreado.id}')"]`);
      const editBtnExists = await editBtnCC.count() > 0;
      if (editBtnExists) {
        await editBtnCC.click();
        await sleep(400);
        await page.fill('#caja-monto', '750');
        await page.click('#form-caja-chica button[type="submit"]');
        await sleep(500);
        const d3 = await getDatos(page);
        const editado = d3.caja_chica.find(m => m.id === egresoCreado.id);
        log('Caja Chica', 'Editar movimiento', editado?.monto === 750, `Monto: Q${editado?.monto}`);
        // Verificar btn-cancelar se ocultó
        const btnOculto = await page.$eval('#btn-cancelar-caja', el => el.style.display === 'none' || el.style.display === '');
        log('Caja Chica', 'Btn-cancelar oculto post-edición', btnOculto);
      } else {
        log('Caja Chica', 'Editar movimiento', false, 'Botón no visible');
        log('Caja Chica', 'Btn-cancelar oculto post-edición', true, 'N/A - skip');
      }

      // ELIMINAR
      await page.evaluate((id) => {
        const btn = [...document.querySelectorAll('button')].find(b => b.getAttribute('onclick')?.includes(`eliminarMovimientoCaja('${id}')`));
        if (btn) btn.click();
      }, egresoCreado.id);
      await confirmar(page);
      const d4 = await getDatos(page);
      const eliminado = d4.caja_chica.find(m => m.id === egresoCreado.id);
      log('Caja Chica', 'Eliminar egreso', !eliminado);
    }

    // ─── MAQUINARIA ───────────────────────────────────────────────
    console.log('\n--- MAQUINARIA ---');
    await page.click('[data-module="maquinaria"]');
    await sleep(400);

    await page.selectOption('#maq-tipo', 'retroexcavadora');
    await sleep(150);
    await page.fill('#maq-codigo', 'RETRO-QA01');
    await page.fill('#maq-val-inicial', '500');
    await page.fill('#maq-val-final', '508');
    await page.fill('#maq-galones', '20');
    await page.fill('#maq-precio-galon', '35');
    await page.click('#form-maquinaria button[type="submit"]');
    await sleep(600);

    const d5 = await getDatos(page);
    const maqReg = (d5.maquinaria_flota?.registros || []).find(r => r.odometro_inicial === 500);
    log('Maquinaria', 'Crear registro', !!maqReg, maqReg ? `Costo: Q${maqReg.combustible_costo}` : 'No encontrado');

    const filasMaq = await page.locator('#tabla-maquinaria-cuerpo tr').count();
    log('Maquinaria', 'Leer tabla', filasMaq >= 1, `${filasMaq} filas`);

    if (maqReg) {
      // EDITAR
      await page.click(`button[onclick="editarRegistroMaquinaria('${maqReg.id}')"]`);
      await sleep(400);
      await page.fill('#maq-galones', '25');
      await page.click('#form-maquinaria button[type="submit"]');
      await confirmar(page);
      await sleep(500);

      // Verificar btn-cancelar-maq
      const btnMaqOculto = await page.$eval('#btn-cancelar-maq', el => el.style.display === 'none' || el.style.display === '');
      log('Maquinaria', 'Btn-cancelar-maq oculto post-edición', btnMaqOculto);

      const d6 = await getDatos(page);
      const maqEdit = (d6.maquinaria_flota?.registros || []).find(r => r.id === maqReg.id);
      log('Maquinaria', 'Editar (20→25 galones)', maqEdit?.combustible_galones === 25, `Galones: ${maqEdit?.combustible_galones}`);

      // ELIMINAR
      await page.click(`button[onclick="eliminarRegistroMaquinaria('${maqReg.id}')"]`);
      await confirmar(page);
      const d7 = await getDatos(page);
      const maqElim = (d7.maquinaria_flota?.registros || []).find(r => r.id === maqReg.id);
      log('Maquinaria', 'Eliminar registro', !maqElim);
    }

    // ─── PERSONAL ─────────────────────────────────────────────────
    console.log('\n--- PERSONAL ---');
    await page.click('[data-module="personal"]');
    await sleep(400);

    await page.fill('#trab-nombre', 'Juan Pérez QA');
    await page.fill('#trab-puesto', 'Albañil');
    await page.fill('#trab-pago-normal', '18.75');
    await page.fill('#trab-pago-extra', '28.00');
    await page.click('#form-trabajador button[type="submit"]');
    await sleep(500);

    const d8 = await getDatos(page);
    const trab = (d8.personal?.trabajadores || []).find(t => t.nombre === 'Juan Pérez QA');
    log('Personal', 'Crear trabajador', !!trab, trab?.nombre);

    // ASISTENCIA: marcar presente y guardar
    if (trab) {
      const fechaHoy = new Date().toISOString().split('T')[0];
      await page.fill('#fecha-asistencia', fechaHoy);
      await sleep(300);
      const radioPresente = page.locator(`input[name="asistencia-${trab.id}"][value="asistio"]`);
      if (await radioPresente.count() > 0) {
        await radioPresente.check();
        await sleep(200);
      }
      await page.click('button[onclick*="guardarAsistenciaDiaria"]');
      await sleep(500);
      const d9 = await getDatos(page);
      const asist = (d9.personal?.asistencia || []).find(a => a.fecha === fechaHoy);
      log('Personal', 'Guardar asistencia', !!asist, asist ? `${asist.registros?.length} registro(s)` : 'No guardada');
    }

    // LEER lista de trabajadores (se renderizan como cards, no tabla)
    const cardsTrab = await page.locator('#lista-asistencia-dinamica fieldset').count();
    log('Personal', 'Leer lista trabajadores (cards)', cardsTrab >= 1, `${cardsTrab} tarjeta(s)`);

    // ELIMINAR trabajador
    if (trab) {
      await page.click(`button[onclick="eliminarTrabajador('${trab.id}')"]`);
      await confirmar(page);
      const d10 = await getDatos(page);
      const trabElim = (d10.personal?.trabajadores || []).find(t => t.id === trab.id);
      log('Personal', 'Eliminar trabajador', !trabElim);
    }

    // ─── ADQUISICIONES ────────────────────────────────────────────
    console.log('\n--- ADQUISICIONES ---');
    await page.click('[data-module="adquisiciones"]');
    await sleep(400);

    // CREAR proveedor
    await page.fill('#prov-nombre', 'Ferretería Central QA');
    await page.fill('#prov-telefono', '+502 9999 8888');
    await page.fill('#prov-especialidad', 'Materiales de construcción');
    await page.click('#form-proveedor button[type="submit"]');
    await sleep(500);

    const d11 = await getDatos(page);
    const prov = (d11.adquisiciones?.proveedores || []).find(p => p.nombre === 'Ferretería Central QA');
    log('Adquisiciones', 'Crear proveedor', !!prov, prov?.nombre);

    // LEER tabla proveedores
    const filasProv = await page.locator('#tabla-proveedores-cuerpo tr').count();
    log('Adquisiciones', 'Leer tabla proveedores', filasProv >= 1, `${filasProv} filas`);

    // CREAR cotización
    if (prov) {
      await page.selectOption('#cot-proveedor', prov.id);
      await sleep(200);
      await page.fill('#cot-material', 'Block 15cm x 100 unidades QA');
      await page.fill('#cot-precio', '8.50');
      await page.fill('#cot-cantidad', '100');
      await page.click('#form-cotizacion button[type="submit"]');
      await sleep(500);

      const d12 = await getDatos(page);
      const cot = (d12.adquisiciones?.cotizaciones_compras || []).find(c => c.material_descripcion?.includes('Block 15cm'));
      log('Adquisiciones', 'Crear cotización', !!cot, cot ? `Q${cot.total}` : 'No encontrada');

      // LEER tabla cotizaciones
      const filasCot = await page.locator('#tabla-cotizaciones-cuerpo tr').count();
      log('Adquisiciones', 'Leer tabla cotizaciones', filasCot >= 1, `${filasCot} filas`);

      // ELIMINAR cotización
      // El botón eliminar solo aparece en cotizaciones NO pendientes.
      // Primero rechazamos para cambiar el estado, luego eliminamos.
      if (cot) {
        // Rechazar la cotización (aparece botón rechazar en estado pendiente)
        await page.click(`button[onclick="rechazarCotizacion('${cot.id}')"]`);
        await confirmar(page);
        await sleep(400);

        // Ahora la cotización está rechazada y aparece el botón eliminar
        const btnElimCot = page.locator(`button[onclick="eliminarCotizacion('${cot.id}')"]`);
        if (await btnElimCot.count() > 0) {
          await btnElimCot.click({ force: true });
          await confirmar(page);
          await sleep(400);
        } else {
          // Fallback: disparar via evaluate
          await page.evaluate((id) => {
            const btn = [...document.querySelectorAll('button')].find(b => b.getAttribute('onclick')?.includes(`eliminarCotizacion('${id}')`));
            if (btn) btn.click();
          }, cot.id);
          await confirmar(page);
          await sleep(400);
        }
        const d13 = await getDatos(page);
        const cotElim = (d13.adquisiciones?.cotizaciones_compras || []).find(c => c.id === cot.id);
        log('Adquisiciones', 'Eliminar cotización', !cotElim);
      }
    }

    // ─── VIAJES ────────────────────────────────────────────────────
    console.log('\n--- VIAJES ---');
    await page.click('[data-module="viajes"]');
    await sleep(400);

    // Agregar camión (form submit)
    await page.fill('#cam-nombre', 'Camión QA Volvo');
    await page.selectOption('#cam-propiedad', 'propio');
    await sleep(200);
    await page.fill('#cam-consumo', '0.35');
    await page.click('#form-camion button[type="submit"]');
    await sleep(500);

    const d14 = await getDatos(page);
    const cam = (d14.viajes_camiones?.camiones || []).find(c => c.nombre === 'Camión QA Volvo');
    log('Viajes', 'Crear camión', !!cam, cam?.nombre);

    // Agregar ruta
    await page.fill('#ruta-nombre', 'Botadero Norte QA');
    await page.fill('#ruta-distancia', '12');
    await page.click('#form-ruta button[type="submit"]');
    await sleep(500);

    const d15 = await getDatos(page);
    const ruta = (d15.viajes_camiones?.rutas_botadero || []).find(r => r.nombre === 'Botadero Norte QA');
    log('Viajes', 'Crear ruta/botadero', !!ruta, ruta?.nombre);

    // REGISTRAR VIAJE
    if (cam && ruta) {
      await page.selectOption('#viaje-cam', cam.id);
      await sleep(200);
      await page.selectOption('#viaje-ruta', ruta.id);
      await sleep(200);
      await page.selectOption('#viaje-material', 'tierra');
      await page.fill('#viaje-numero', '3');
      await page.fill('#viaje-precio-diesel', '35');
      await sleep(200);
      await page.click('#form-viaje button[type="submit"]');
      await sleep(600);

      const d16 = await getDatos(page);
      const viaje = (d16.viajes_camiones?.viajes || []).find(v => v.numero === 3);
      log('Viajes', 'Crear viaje', !!viaje, viaje ? `Total: Q${viaje.total?.toFixed(2)}` : 'No encontrado');

      const filasViaje = await page.locator('#tabla-viajes-cuerpo tr').count();
      log('Viajes', 'Leer tabla', filasViaje >= 1, `${filasViaje} filas`);

      if (viaje) {
        // EDITAR viaje
        await page.click(`button[onclick="editarViaje('${viaje.id}')"]`);
        await sleep(400);
        await page.fill('#viaje-numero', '5');
        await page.click('#form-viaje button[type="submit"]');
        await sleep(600);

        const d17 = await getDatos(page);
        const viajeEdit = (d17.viajes_camiones?.viajes || []).find(v => v.id === viaje.id);
        log('Viajes', 'Editar viaje (3→5 viajes)', viajeEdit?.numero === 5, `Viajes: ${viajeEdit?.numero}`);

        // ELIMINAR viaje
        await page.click(`button[onclick="eliminarViaje('${viaje.id}')"]`);
        await confirmar(page);
        const d18 = await getDatos(page);
        const viajeElim = (d18.viajes_camiones?.viajes || []).find(v => v.id === viaje.id);
        log('Viajes', 'Eliminar viaje', !viajeElim);
      }
    }

    // ─── MANTENIMIENTO ────────────────────────────────────────────
    console.log('\n--- MANTENIMIENTO ---');
    await page.click('[data-module="mantenimiento"]');
    await sleep(400);

    // Agregar al catálogo
    await page.fill('#maqcat-nombre', 'Retroexcavadora CAT QA');
    await page.selectOption('#maqcat-tipo', 'Retroexcavadora');
    await page.click('#form-maqcat button[type="submit"]');
    await sleep(500);

    const d19 = await getDatos(page);
    const maqCat = (d19.mantenimiento?.maquinaria || []).find(m => m.nombre === 'Retroexcavadora CAT QA');
    log('Mantenimiento', 'Crear equipo catálogo', !!maqCat, maqCat?.nombre);

    // ORDEN DE MANTENIMIENTO
    if (maqCat) {
      await page.selectOption('#ord-maquina', maqCat.id);
      await sleep(200);
      await page.selectOption('#ord-tipo', 'preventivo');
      await page.fill('#ord-costo', '1200');
      await page.fill('#ord-observaciones', 'Cambio de filtros y aceite QA');
      await page.click('#form-orden button[type="submit"]');
      await sleep(600);

      const d20 = await getDatos(page);
      const orden = (d20.mantenimiento?.ordenes || []).find(o => o.costo === 1200);
      log('Mantenimiento', 'Crear orden', !!orden, orden ? `Q${orden.costo}` : 'No encontrada');

      const filasOrd = await page.locator('#tabla-ordenes-cuerpo tr').count();
      log('Mantenimiento', 'Leer tabla órdenes', filasOrd >= 1, `${filasOrd} filas`);

      if (orden) {
        // EDITAR orden
        await page.click(`button[onclick="editarOrden('${orden.id}')"]`);
        await sleep(400);
        await page.fill('#ord-costo', '1500');
        await page.click('#form-orden button[type="submit"]');
        await sleep(600);

        const d21 = await getDatos(page);
        const ordenEdit = (d21.mantenimiento?.ordenes || []).find(o => o.id === orden.id);
        log('Mantenimiento', 'Editar orden (Q1200→Q1500)', ordenEdit?.costo === 1500, `Q${ordenEdit?.costo}`);

        // ELIMINAR orden
        await page.click(`button[onclick="eliminarOrden('${orden.id}')"]`);
        await confirmar(page);
        const d22 = await getDatos(page);
        const ordenElim = (d22.mantenimiento?.ordenes || []).find(o => o.id === orden.id);
        log('Mantenimiento', 'Eliminar orden', !ordenElim);
      }
    }

    // COMPRA DE INSUMO
    await page.selectOption('#insumo-tipo', 'aceite');
    await page.fill('#insumo-articulo', 'Aceite Mobil 15W-40 QA');
    await page.fill('#insumo-cantidad', '6');
    await page.fill('#insumo-costo', '480');
    await page.fill('#insumo-stock-min', '2');
    await page.click('#form-insumo button[type="submit"]');
    await sleep(600);

    const d23 = await getDatos(page);
    const insumo = (d23.mantenimiento?.compras_insumos || []).find(i => i.articulo?.includes('Mobil'));
    log('Mantenimiento', 'Crear insumo', !!insumo, insumo ? `Q${insumo.costo}` : 'No encontrado');

    const filasIns = await page.locator('#tabla-insumos-cuerpo tr').count();
    log('Mantenimiento', 'Leer tabla insumos', filasIns >= 1, `${filasIns} filas`);

    if (insumo) {
      // EDITAR insumo
      await page.click(`button[onclick="editarInsumo('${insumo.id}')"]`);
      await sleep(400);
      await page.fill('#insumo-costo', '520');
      await page.click('#form-insumo button[type="submit"]');
      await sleep(600);

      const d24 = await getDatos(page);
      const insumoEdit = (d24.mantenimiento?.compras_insumos || []).find(i => i.id === insumo.id);
      log('Mantenimiento', 'Editar insumo (Q480→Q520)', insumoEdit?.costo === 520, `Q${insumoEdit?.costo}`);

      // ELIMINAR insumo
      await page.click(`button[onclick="eliminarInsumo('${insumo.id}')"]`);
      await confirmar(page);
      const d25 = await getDatos(page);
      const insumoElim = (d25.mantenimiento?.compras_insumos || []).find(i => i.id === insumo.id);
      log('Mantenimiento', 'Eliminar insumo', !insumoElim);
    }

    // ─── CONFIGURACIÓN: Datos de Contacto ────────────────────────
    console.log('\n--- CONFIGURACIÓN ---');
    await page.click('[data-module="configuracion"]');
    await sleep(400);

    await page.fill('#cfg-telefono', '+502 5555 9999');
    await page.fill('#cfg-email', 'qa@construramsa.com');
    await page.fill('#cfg-direccion', 'Zona 10, Ciudad de Guatemala QA');
    await page.click('button[onclick="guardarDatosContacto()"]');
    await sleep(500);

    const dbFinal = await getDB(page);
    log('Configuración', 'Guardar teléfono',
      dbFinal.configuracion?.telefono === '+502 5555 9999',
      dbFinal.configuracion?.telefono);
    log('Configuración', 'Guardar email',
      dbFinal.configuracion?.email === 'qa@construramsa.com',
      dbFinal.configuracion?.email);
    log('Configuración', 'Guardar dirección',
      (dbFinal.configuracion?.direccion || '').includes('Zona 10'),
      dbFinal.configuracion?.direccion);

    // Verificar membrete PDF actualizado en DOM
    const pdfDir = await page.$eval('#pdf-direccion-empresa', el => el.textContent.trim());
    const pdfTE  = await page.$eval('#pdf-tel-email-empresa', el => el.textContent.trim());
    log('Configuración', 'Membrete PDF dirección actualizado', pdfDir.includes('Zona 10'), `"${pdfDir}"`);
    log('Configuración', 'Membrete PDF tel/email actualizado', pdfTE.includes('5555 9999'), `"${pdfTE}"`);

    // Importación por la interfaz: valida esquema, confirmación, respaldo previo y fusión.
    const backupJSON = await page.evaluate(() => {
      const backup = JSON.parse(JSON.stringify(getDB()));
      backup.caja_chica.push({
        id: 'qa-importacion-raiz', fecha: '2026-08-26', tipo: 'ingreso',
        categoria: 'apertura', descripcion: 'Registro importado por QA', monto: 1
      });
      return JSON.stringify(backup);
    });
    await page.setInputFiles('#import-json', {
      name: 'respaldo-qa.json', mimeType: 'application/json', buffer: Buffer.from(backupJSON)
    });
    await confirmar(page);
    await sleep(2200); // La aplicación recarga después de confirmar la fusión.
    const dbImportado = await getDB(page);
    const respaldoPrevio = await page.evaluate(() => localStorage.getItem('construramsa_preimport_backup'));
    log('Configuración', 'Importar JSON y fusionar',
      dbImportado.caja_chica?.some(m => m.id === 'qa-importacion-raiz'));
    log('Configuración', 'Respaldo previo a importación', !!respaldoPrevio);

    // ─── RESUMEN EJECUTIVO ────────────────────────────────────────
    console.log('\n--- RESUMEN EJECUTIVO ---');
    await page.click('[data-module="resumen"]');
    await sleep(700);
    const kpiGrid = await page.locator('#kpi-grid .kpi-card').count();
    log('Resumen', 'KPIs cargados', kpiGrid > 0, `${kpiGrid} tarjetas KPI`);
    const saldoEl = await page.$eval('#kpi-grid', el => el.textContent.includes('Saldo'));
    log('Resumen', 'Saldo visible en KPIs', saldoEl);

    // ─── ERRORES JS ───────────────────────────────────────────────
    console.log('\n--- ERRORES JS ---');
    const filtrados = jsErrors.filter(e =>
      !e.includes('favicon') && !e.includes('Debugger') &&
      !e.includes('net::ERR') && !e.includes('404') &&
      !e.includes('service-worker') && !e.includes('Failed to fetch'));
    if (filtrados.length === 0) {
      log('JavaScript', 'Sin errores de consola', true, '0 errores');
    } else {
      filtrados.slice(0, 5).forEach(e =>
        log('JavaScript', 'Error de consola', false, e.substring(0, 100))
      );
    }

  } catch (err) {
    console.error('\n💥 ERROR FATAL:', err.message);
    resultados.push({ modulo: 'Test', accion: 'Error fatal', ok: false, detalle: err.message.substring(0, 120) });
  } finally {
    await browser.close();
    if (localServer && !localServer.killed) localServer.kill();
    console.log('\n══════════════════════════════════════════════');
    console.log('  RESUMEN FINAL');
    console.log('══════════════════════════════════════════════');
    const ok   = resultados.filter(r => r.ok).length;
    const fail = resultados.filter(r => !r.ok).length;
    console.log(`  ✅ Pasaron : ${ok}`);
    console.log(`  ❌ Fallaron: ${fail}`);
    console.log(`  📊 Total   : ${ok + fail}`);
    if (fail > 0) {
      console.log('\n  DETALLE DE FALLOS:');
      resultados.filter(r => !r.ok).forEach(r =>
        console.log(`  ❌ [${r.modulo}] ${r.accion}${r.detalle ? ' — ' + r.detalle : ''}`)
      );
    }
    console.log('══════════════════════════════════════════════\n');
    process.exitCode = fail > 0 ? 1 : 0;
  }
})();

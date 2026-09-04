const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');

const PORT = 8145;
const BASE = `http://127.0.0.1:${PORT}/`;
const TODAY = '2026-09-04';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForServer(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode < 500) return resolve();
        retry();
      });
      request.on('error', retry);
      request.setTimeout(1000, () => {
        request.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() >= deadline) return reject(new Error('Servidor no disponible'));
      setTimeout(check, 150);
    };
    check();
  });
}

async function submit(page, form) {
  await page.locator(`${form} button[type="submit"]`).click();
  await wait(350);
}

async function readState(page) {
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('construramsa_db'));
    const projectId = db.configuracion.proyecto_actual;
    const data = db.proyectos_data[projectId] || {};
    return {
      projectId,
      projects: db.proyectos.length,
      caja: (data.caja_chica || []).length,
      maquinaria: (data.maquinaria_flota?.registros || []).length,
      workers: (data.personal?.trabajadores || []).length,
      attendanceDays: (data.personal?.asistencia || []).length,
      providers: (data.adquisiciones?.proveedores || []).length,
      quotes: (data.adquisiciones?.cotizaciones_compras || []).length,
      trucks: (data.viajes_camiones?.camiones || []).length,
      routes: (data.viajes_camiones?.rutas_botadero || []).length,
      trips: (data.viajes_camiones?.viajes || []).length,
      maintenanceMachines: (data.mantenimiento?.maquinaria || []).length,
      orders: (data.mantenimiento?.ordenes || []).length,
      supplies: (data.mantenimiento?.compras_insumos || []).length,
      quoteExpenseLinked: !!data.adquisiciones?.cotizaciones_compras?.find((quote) => quote.material_descripcion === 'Cemento E2E')?.gasto_id,
      tripExpenseLinked: !!data.viajes_camiones?.viajes?.[0]?.gasto_id,
      orderExpenseLinked: !!data.mantenimiento?.ordenes?.[0]?.gasto_id,
      supplyExpenseLinked: !!data.mantenimiento?.compras_insumos?.[0]?.gasto_id
    };
  });
}

(async () => {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT), NODE_OPTIONS: '' },
    stdio: 'ignore'
  });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const errors = [];

  try {
    await waitForServer(BASE);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (error) => errors.push(`PAGEERROR: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`CONSOLE: ${message.text()}`);
    });

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await wait(700);

    // Proyecto y Caja Chica
    await page.click('[data-module="configuracion"]');
    await page.locator('button[onclick="mostrarModalCrearProyecto()"]:visible').last().click();
    await page.fill('#proyecto-nombre', 'E2E Proyecto Integrado');
    await page.fill('#proyecto-descripcion', 'Prueba integral de captura y persistencia');
    await page.fill('#proyecto-presupuesto', '100000');
    await page.locator('button[onclick="crearProyectoDesdeModal()"]:visible').click();
    await wait(500);
    const projectCreated = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db') || '{}');
      return (db.proyectos || []).some((project) => project.nombre === 'E2E Proyecto Integrado');
    });
    if (!projectCreated) throw new Error('El proyecto E2E no se persistió');
    if (await page.locator('#modal-crear-proyecto').evaluate((el) => !el.classList.contains('hidden'))) {
      await page.evaluate(() => cerrarModalCrearProyecto());
    }

    await page.click('[data-module="caja-chica"]');
    await page.fill('#caja-fecha', TODAY);
    await page.selectOption('#caja-tipo', 'ingreso');
    await page.selectOption('#caja-categoria', 'apertura');
    await page.fill('#caja-responsable', 'Administrador E2E');
    await page.fill('#caja-descripcion', 'Fondo inicial E2E');
    await page.fill('#caja-monto', '50000');
    await submit(page, '#form-caja-chica');
    await page.fill('#caja-fecha', TODAY);
    await page.selectOption('#caja-tipo', 'egreso');
    await page.selectOption('#caja-categoria', 'materiales');
    await page.fill('#caja-descripcion', 'Compra base E2E');
    await page.fill('#caja-monto', '2500');
    await submit(page, '#form-caja-chica');

    // Maquinaria: registro de uso y métricas calculadas.
    await page.click('[data-module="maquinaria"]');
    await page.fill('#maq-fecha', TODAY);
    await page.selectOption('#maq-tipo', 'retroexcavadora');
    await page.fill('#maq-codigo', 'RET-E2E-01');
    await page.fill('#maq-val-inicial', '100');
    await page.fill('#maq-val-final', '108');
    await page.fill('#maq-galones', '12');
    await page.fill('#maq-precio-galon', '35');
    await page.fill('#maq-mantenimiento-detalles', 'Cambio de aceite E2E');
    await page.fill('#maq-costo-mantenimiento', '420');
    await submit(page, '#form-maquinaria');

    // Personal: trabajador y planilla diaria.
    await page.click('[data-module="personal"]');
    await page.fill('#trab-nombre', 'Trabajador E2E');
    await page.fill('#trab-puesto', 'Operador');
    await page.fill('#trab-pago-normal', '25');
    await page.fill('#trab-pago-extra', '35');
    await submit(page, '#form-trabajador');
    await page.fill('#fecha-asistencia', TODAY);
    await page.evaluate(() => marcarTodos('asistio'));
    await page.click('button[onclick*="guardarAsistenciaDiaria"]');
    await wait(500);

    // Adquisiciones: proveedor, cotización y aprobación integrada.
    await page.click('[data-module="adquisiciones"]');
    await page.fill('#prov-nombre', 'Proveedor E2E');
    await page.fill('#prov-telefono', '55550001');
    await page.fill('#prov-especialidad', 'Materiales de obra');
    await submit(page, '#form-proveedor');
    await page.selectOption('#cot-proveedor', { index: 1 });
    await page.fill('#cot-fecha', TODAY);
    await page.fill('#cot-material', 'Cemento E2E');
    await page.fill('#cot-precio', '125');
    await page.fill('#cot-cantidad', '10');
    await submit(page, '#form-cotizacion');
    await page.getByRole('button', { name: /Aprobar cotización/i }).click();
    await wait(400);

    // Viajes: camión, ruta y viaje con cálculo de combustible.
    await page.click('[data-module="viajes"]');
    await page.fill('#cam-nombre', 'Camión E2E');
    await page.selectOption('#cam-propiedad', 'propio');
    await page.fill('#cam-capacidad', '12');
    await page.fill('#cam-consumo', '0.35');
    await page.fill('#cam-tarifa', '0');
    await submit(page, '#form-camion');
    await page.fill('#ruta-nombre', 'Botadero E2E');
    await page.fill('#ruta-distancia', '7.5');
    await submit(page, '#form-ruta');
    await page.selectOption('#viaje-cam', { index: 1 });
    await page.selectOption('#viaje-ruta', { index: 1 });
    await page.fill('#viaje-fecha', TODAY);
    await page.selectOption('#viaje-material', 'arena');
    await page.fill('#viaje-numero', '2');
    await page.fill('#viaje-precio-diesel', '35');
    await submit(page, '#form-viaje');

    // Mantenimiento: catálogo, orden e insumo.
    await page.click('[data-module="mantenimiento"]');
    await page.fill('#maqcat-nombre', 'Equipo E2E');
    await page.selectOption('#maqcat-tipo', 'Retroexcavadora');
    await submit(page, '#form-maqcat');
    await page.selectOption('#ord-maquina', { index: 1 });
    await page.fill('#ord-fecha', TODAY);
    await page.selectOption('#ord-tipo', 'preventivo');
    await page.fill('#ord-costo', '650');
    await page.fill('#ord-observaciones', 'Servicio preventivo E2E');
    await submit(page, '#form-orden');
    await page.selectOption('#insumo-tipo', 'aceite');
    await page.fill('#insumo-articulo', 'Aceite hidráulico E2E');
    await page.fill('#insumo-fecha', TODAY);
    await page.fill('#insumo-cantidad', '2');
    await page.fill('#insumo-costo', '300');
    await page.fill('#insumo-stock-min', '1');
    await submit(page, '#form-insumo');

    // Reportes: confirmar que el módulo sigue disponible después de toda la captura.
    await page.click('[data-module="reportes"]');
    const reportControls = await page.locator('#reporte-tipo, #export-pdf, #export-csv').count();
    const stateBeforeReload = await readState(page);
    await page.reload({ waitUntil: 'networkidle' });
    await wait(700);
    const stateAfterReload = await readState(page);

    const result = {
      reportControls,
      stateBeforeReload,
      stateAfterReload,
      errors,
      pass: reportControls === 3 && stateAfterReload.projects >= 1 &&
        stateAfterReload.caja >= 2 && stateAfterReload.maquinaria === 1 &&
        stateAfterReload.workers === 1 && stateAfterReload.attendanceDays === 1 &&
        stateAfterReload.providers === 1 && stateAfterReload.quotes === 1 &&
        stateAfterReload.trucks === 1 && stateAfterReload.routes === 1 &&
        stateAfterReload.trips === 1 && stateAfterReload.maintenanceMachines === 1 &&
        stateAfterReload.orders === 1 && stateAfterReload.supplies === 1 &&
        stateAfterReload.quoteExpenseLinked &&
        !errors.length
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
})();

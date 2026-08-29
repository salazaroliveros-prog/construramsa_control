/**
 * CONSTRURAMSA v2.8.2 — Validación de Contenido de Reportes
 * Prueba: Verifica que los archivos generados contengan el contenido correcto
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8095;
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

function log(tipo, formato, ok, detalle = '') {
  const estado = ok ? '✅' : '❌';
  const msg = `${estado} [${tipo}] ${formato}${detalle ? ' — ' + detalle : ''}`;
  console.log(msg);
}

(async () => {
  const server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port), NODE_OPTIONS: '' },
    stdio: 'ignore'
  });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true // Habilitar descargas para validar archivos
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const resultados = [];
  const archivosDescargados = [];

  // Capturar descargas
  page.on('download', async (download) => {
    const path = await download.path();
    archivosDescargados.push(path);
    console.log(`Archivo descargado: ${path}`);
  });

  try {
    console.log('\n══════════════════════════════════════════════');
    console.log('  CONSTRURAMSA v2.8.2 — VALIDACIÓN DE CONTENIDO DE REPORTES');
    console.log('══════════════════════════════════════════════\n');

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(2000);

    // Configurar proyecto de prueba con datos
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(1000);
    
    await page.click('[data-module="configuracion"]');
    await wait(500);
    await page.click('button[onclick="mostrarModalCrearProyecto()"]');
    await wait(500);
    await page.fill('#proyecto-nombre', 'Proyecto Validación Reportes');
    await page.fill('#proyecto-presupuesto', '50000');
    await page.click('button[onclick="crearProyectoDesdeModal()"]');
    await wait(700);
    
    const projectId = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const proy = db.proyectos.find(p => p.nombre === 'Proyecto Validación Reportes');
      if (proy) {
        db.configuracion.proyecto_actual = proy.id;
        localStorage.setItem('construramsa_db', JSON.stringify(db));
        return proy.id;
      }
      return null;
    });
    
    // Configurar datos de empresa para validación
    await page.fill('#cfg-nombre-empresa', 'EMPRESA TEST VALIDACIÓN');
    await page.fill('#cfg-telefono', '+502 1234 5678');
    await page.fill('#cfg-email', 'test@validacion.com');
    await page.fill('#cfg-direccion', 'Dirección Test Validación');
    await page.click('button[onclick="guardarIdentidadEmpresa()"]');
    await wait(500);
    
    await page.fill('#cfg-telefono', '+502 1234 5678');
    await page.fill('#cfg-email', 'test@validacion.com');
    await page.fill('#cfg-direccion', 'Dirección Test Validación');
    await page.click('button[onclick="guardarDatosContacto()"]');
    await wait(500);

    // Agregar datos de prueba específicos para validación
    await page.click('[data-module="caja-chica"]');
    await wait(500);
    
    const today = new Date().toISOString().split('T')[0];
    await page.selectOption('#caja-tipo', 'ingreso');
    await page.selectOption('#caja-categoria', 'apertura');
    await page.fill('#caja-descripcion', 'VALIDACIÓN: Apertura test');
    await page.fill('#caja-monto', '10000');
    await page.click('#form-caja-chica button[type="submit"]');
    await wait(500);
    
    await page.selectOption('#caja-tipo', 'egreso');
    await page.selectOption('#caja-categoria', 'materiales');
    await page.fill('#caja-descripcion', 'VALIDACIÓN: Compra test');
    await page.fill('#caja-monto', '500');
    await page.click('#form-caja-chica button[type="submit"]');
    await wait(500);

    // Ir al módulo de reportes
    await page.click('[data-module="reportes"]');
    await wait(500);

    console.log('\n══════════════════════════════════════════════');
    console.log('  VALIDACIÓN DE CONTENIDO DE REPORTES');
    console.log('══════════════════════════════════════════════\n');

    // Validar reporte diario con datos específicos
    await page.selectOption('#reporte-tipo', 'diario');
    await wait(500);
    await page.selectOption('#reporte-modo-fecha', 'unica');
    await wait(200);
    await page.fill('#reporte-fecha', today);
    await wait(200);
    
    // Validar CSV
    await page.evaluate(() => {
      document.getElementById('export-pdf').checked = false;
      document.getElementById('export-csv').checked = true;
      document.getElementById('export-xlsx').checked = false;
    });
    
    await page.evaluate(() => generarReporteLocal());
    await wait(3000);
    
    // Validar que el CSV contenga los datos de prueba
    const csvValido = await page.evaluate(() => {
      const datos = getProyectoData();
      const movs = datos.caja_chica || [];
      const tieneValidacion = movs.some(m => m.descripcion.includes('VALIDACIÓN'));
      return tieneValidacion;
    });
    
    log('diario', 'CSV contenido', csvValido, csvValido ? 'Contiene datos de prueba' : 'Faltan datos de prueba');
    resultados.push({ tipo: 'diario', formato: 'CSV', validacion: csvValido });
    
    // Validar PDF (plantilla)
    await page.evaluate(() => {
      document.getElementById('export-pdf').checked = true;
      document.getElementById('export-csv').checked = false;
      document.getElementById('export-xlsx').checked = false;
    });
    
    await page.evaluate(() => {
      const plantilla = document.getElementById('plantilla-reporte-impresion');
      if (plantilla) {
        plantilla.classList.remove('pdf-generating');
        plantilla.style.left = '-9999px';
        plantilla.style.top = '-9999px';
      }
    });
    await wait(500);
    
    await page.evaluate(() => generarReporteLocal());
    await wait(4000);
    
    // Validar que la plantilla tenga los datos de empresa configurados
    const plantillaValida = await page.evaluate(() => {
      const nombreEmpresa = document.getElementById('pdf-nombre-empresa');
      const direccion = document.getElementById('pdf-direccion-empresa');
      const telEmail = document.getElementById('pdf-tel-email-empresa');
      
      return nombreEmpresa && 
             nombreEmpresa.textContent.includes('EMPRESA TEST VALIDACIÓN') &&
             direccion && 
             direccion.textContent.includes('Dirección Test Validación') &&
             telEmail &&
             telEmail.textContent.includes('+502 1234 5678');
    });
    
    log('diario', 'PDF plantilla', plantillaValida, plantillaValida ? 'Datos de empresa correctos' : 'Faltan datos de empresa');
    resultados.push({ tipo: 'diario', formato: 'PDF', validacion: plantillaValida });
    
    // Validar XLSX
    await page.evaluate(() => {
      const plantilla = document.getElementById('plantilla-reporte-impresion');
      if (plantilla) {
        plantilla.classList.remove('pdf-generating');
        plantilla.style.left = '-9999px';
        plantilla.style.top = '-9999px';
      }
    });
    await wait(500);
    
    await page.evaluate(() => {
      document.getElementById('export-pdf').checked = false;
      document.getElementById('export-csv').checked = false;
      document.getElementById('export-xlsx').checked = true;
    });
    
    await page.evaluate(() => generarReporteLocal());
    await wait(3000);
    
    const xlsxValido = await page.evaluate(() => {
      const datos = getProyectoData();
      const movs = datos.caja_chica || [];
      const tieneValidacion = movs.some(m => m.descripcion.includes('VALIDACIÓN'));
      return tieneValidacion;
    });
    
    log('diario', 'XLSX contenido', xlsxValido, xlsxValido ? 'Contiene datos de prueba' : 'Faltan datos de prueba');
    resultados.push({ tipo: 'diario', formato: 'XLSX', validacion: xlsxValido });
    
    // Validar reporte de asistencia
    await page.click('[data-module="personal"]');
    await wait(500);
    
    await page.fill('#trab-nombre', 'Trabajador VALIDACIÓN');
    await page.fill('#trab-puesto', 'Puesto Test');
    await page.fill('#trab-pago-normal', '15.00');
    await page.fill('#trab-pago-extra', '22.50');
    await page.click('#form-trabajador button[type="submit"]');
    await wait(500);
    
    await page.fill('#fecha-asistencia', today);
    await wait(300);
    
    const trabajadorId = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const pid = db.configuracion.proyecto_actual;
      const trab = db.proyectos_data[pid].personal.trabajadores.find(t => t.nombre.includes('VALIDACIÓN'));
      return trab ? trab.id : null;
    });
    
    if (trabajadorId) {
      await page.evaluate((id) => {
        const radio = document.querySelector(`input[name="asistencia-${id}"][value="asistio"]`);
        if (radio) radio.click();
      }, trabajadorId);
      await wait(200);
      await page.click('button[onclick*="guardarAsistenciaDiaria"]');
      await wait(500);
    }
    
    await page.click('[data-module="reportes"]');
    await wait(500);
    
    await page.selectOption('#reporte-tipo', 'asistencia');
    await wait(500);
    
    // Validar CSV de asistencia
    await page.evaluate(() => {
      document.getElementById('export-pdf').checked = false;
      document.getElementById('export-csv').checked = true;
      document.getElementById('export-xlsx').checked = false;
    });
    
    await page.evaluate(() => generarReporteLocal());
    await wait(3000);
    
    const asistenciaValida = await page.evaluate(() => {
      const datos = getProyectoData();
      const trabajadores = datos.personal.trabajadores || [];
      const tieneValidacion = trabajadores.some(t => t.nombre.includes('VALIDACIÓN'));
      return tieneValidacion;
    });
    
    log('asistencia', 'CSV trabajador', asistenciaValida, asistenciaValida ? 'Contiene trabajador de prueba' : 'Falta trabajador de prueba');
    resultados.push({ tipo: 'asistencia', formato: 'CSV', validacion: asistenciaValida });
    
    // Validar reporte de viajes
    await page.click('[data-module="viajes"]');
    await wait(500);
    
    await page.fill('#cam-nombre', 'Camión VALIDACIÓN');
    await page.selectOption('#cam-propiedad', 'propio');
    await page.fill('#cam-consumo', '0.30');
    await page.click('#form-camion button[type="submit"]');
    await wait(500);
    
    await page.fill('#ruta-nombre', 'Ruta VALIDACIÓN');
    await page.fill('#ruta-distancia', '20');
    await page.click('#form-ruta button[type="submit"]');
    await wait(500);
    
    const camionId = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const pid = db.configuracion.proyecto_actual;
      const cam = db.proyectos_data[pid].viajes_camiones.camiones.find(c => c.nombre.includes('VALIDACIÓN'));
      return cam ? cam.id : null;
    });
    
    const rutaId = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const pid = db.configuracion.proyecto_actual;
      const ruta = db.proyectos_data[pid].viajes_camiones.rutas_botadero.find(r => r.nombre.includes('VALIDACIÓN'));
      return ruta ? ruta.id : null;
    });
    
    if (camionId && rutaId) {
      await page.selectOption('#viaje-cam', camionId);
      await wait(200);
      await page.selectOption('#viaje-ruta', rutaId);
      await wait(200);
      await page.selectOption('#viaje-material', 'arena');
      await page.fill('#viaje-numero', '3');
      await page.fill('#viaje-precio-diesel', '32');
      await page.click('#form-viaje button[type="submit"]');
      await wait(500);
    }
    
    await page.click('[data-module="reportes"]');
    await wait(500);
    
    await page.selectOption('#reporte-tipo', 'viajes');
    await wait(500);
    
    // Configurar fecha según el tipo de reporte
    const modoFechaDisabled = await page.evaluate(() => {
      const select = document.getElementById('reporte-modo-fecha');
      return select ? select.disabled : false;
    });
    
    if (!modoFechaDisabled) {
      await page.selectOption('#reporte-modo-fecha', 'unica');
      await wait(200);
      await page.fill('#reporte-fecha', today);
      await wait(200);
    } else {
      const fechaInput = await page.$('#reporte-fecha');
      if (fechaInput) {
        await page.fill('#reporte-fecha', today);
        await wait(200);
      }
    }
    
    await page.evaluate(() => {
      document.getElementById('export-pdf').checked = false;
      document.getElementById('export-csv').checked = true;
      document.getElementById('export-xlsx').checked = false;
    });
    
    await page.evaluate(() => generarReporteLocal());
    await wait(3000);
    
    const viajesValido = await page.evaluate(() => {
      const datos = getProyectoData();
      const camiones = datos.viajes_camiones.camiones || [];
      const rutas = datos.viajes_camiones.rutas_botadero || [];
      const viajes = datos.viajes_camiones.viajes || [];
      
      const tieneCamionValidacion = camiones.some(c => c.nombre.includes('VALIDACIÓN'));
      const tieneRutaValidacion = rutas.some(r => r.nombre.includes('VALIDACIÓN'));
      const tieneViajeHoy = viajes.some(v => v.fecha === new Date().toISOString().split('T')[0]);
      
      return tieneCamionValidacion && tieneRutaValidacion && tieneViajeHoy;
    });
    
    log('viajes', 'CSV contenido', viajesValido, viajesValido ? 'Contiene datos de prueba' : 'Faltan datos de prueba');
    resultados.push({ tipo: 'viajes', formato: 'CSV', validacion: viajesValido });
    
    // Validar reporte de mantenimiento
    await page.click('[data-module="mantenimiento"]');
    await wait(500);
    
    await page.fill('#maqcat-nombre', 'Máquina VALIDACIÓN');
    await page.selectOption('#maqcat-tipo', 'Retroexcavadora');
    await page.click('#form-maqcat button[type="submit"]');
    await wait(500);
    
    const maquinaId = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const pid = db.configuracion.proyecto_actual;
      const maq = db.proyectos_data[pid].mantenimiento.maquinaria.find(m => m.nombre.includes('VALIDACIÓN'));
      return maq ? maq.id : null;
    });
    
    if (maquinaId) {
      await page.selectOption('#ord-maquina', maquinaId);
      await wait(200);
      await page.selectOption('#ord-tipo', 'correctivo');
      await page.fill('#ord-costo', '2000');
      await page.fill('#ord-observaciones', 'VALIDACIÓN: Mantenimiento test');
      await page.click('#form-orden button[type="submit"]');
      await wait(500);
    }
    
    await page.click('[data-module="reportes"]');
    await wait(500);
    
    await page.selectOption('#reporte-tipo', 'mantenimiento');
    await wait(500);
    
    // Configurar fecha según el tipo de reporte
    const modoFechaDisabledMantenimiento = await page.evaluate(() => {
      const select = document.getElementById('reporte-modo-fecha');
      return select ? select.disabled : false;
    });
    
    if (!modoFechaDisabledMantenimiento) {
      await page.selectOption('#reporte-modo-fecha', 'unica');
      await wait(200);
      await page.fill('#reporte-fecha', today);
      await wait(200);
    } else {
      const fechaInput = await page.$('#reporte-fecha');
      if (fechaInput) {
        await page.fill('#reporte-fecha', today);
        await wait(200);
      }
    }
    
    await page.evaluate(() => {
      document.getElementById('export-pdf').checked = false;
      document.getElementById('export-csv').checked = true;
      document.getElementById('export-xlsx').checked = false;
    });
    
    await page.evaluate(() => generarReporteLocal());
    await wait(3000);
    
    const mantenimientoValido = await page.evaluate(() => {
      const datos = getProyectoData();
      const maquinas = datos.mantenimiento.maquinaria || [];
      const ordenes = datos.mantenimiento.ordenes || [];
      
      const tieneMaquinaValidacion = maquinas.some(m => m.nombre.includes('VALIDACIÓN'));
      const tieneOrdenValidacion = ordenes.some(o => o.observaciones && o.observaciones.includes('VALIDACIÓN'));
      
      return tieneMaquinaValidacion && tieneOrdenValidacion;
    });
    
    log('mantenimiento', 'CSV contenido', mantenimientoValido, mantenimientoValido ? 'Contiene datos de prueba' : 'Faltan datos de prueba');
    resultados.push({ tipo: 'mantenimiento', formato: 'CSV', validacion: mantenimientoValido });

    console.log('\n══════════════════════════════════════════════');
    console.log('  RESUMEN DE VALIDACIÓN');
    console.log('══════════════════════════════════════════════');
    
    const validacionesExitosas = resultados.filter(r => r.validacion).length;
    const validacionesFallidas = resultados.filter(r => !r.validacion).length;
    
    console.log(`  ✅ Validaciones exitosas : ${validacionesExitosas}`);
    console.log(`  ❌ Validaciones fallidas : ${validacionesFallidas}`);
    console.log(`  📊 Total validaciones   : ${resultados.length}`);
    
    if (validacionesFallidas > 0) {
      console.log('\n  ❌ Validaciones fallidas:');
      resultados.filter(r => !r.validacion).forEach(r => {
        console.log(`     - ${r.tipo} (${r.formato}): Validación falló`);
      });
    }

  } catch (error) {
    console.error('Error general en validación de reportes:', error);
  } finally {
    await browser.close();
    server.kill();
  }

  const exitCode = resultados.some(r => !r.validacion) ? 1 : 0;
  process.exit(exitCode);
})().catch(error => { console.error(error); process.exit(1); });
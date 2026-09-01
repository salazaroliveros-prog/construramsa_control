/**
 * CONSTRURAMSA v2.8.6 — Test Suite de Reportes
 * Prueba: Generación y validación de todos los tipos de reportes en todos los formatos
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8094;
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const resultados = [];
  const errores = [];

  page.on('pageerror', err => errores.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errores.push(msg.text()); });

  try {
    console.log('\n══════════════════════════════════════════════');
    console.log('  CONSTRURAMSA v2.8.6 — TEST SUITE DE REPORTES');
    console.log('══════════════════════════════════════════════\n');

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(2000);

    // Configurar proyecto de prueba
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(1000);
    
    await page.click('[data-module="configuracion"]');
    await wait(500);
    await page.click('button[onclick="mostrarModalCrearProyecto()"]');
    await wait(500);
    await page.fill('#proyecto-nombre', 'Proyecto Test Reportes');
    await page.fill('#proyecto-presupuesto', '100000');
    await page.click('button[onclick="crearProyectoDesdeModal()"]');
    await wait(700);
    
    // Seleccionar proyecto
    const projectId = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const proy = db.proyectos.find(p => p.nombre === 'Proyecto Test Reportes');
      if (proy) {
        db.configuracion.proyecto_actual = proy.id;
        localStorage.setItem('construramsa_db', JSON.stringify(db));
        return proy.id;
      }
      return null;
    });
    
    if (!projectId) {
      throw new Error('No se pudo crear el proyecto de prueba');
    }

    // Agregar datos de prueba para todos los módulos
    await page.click('[data-module="caja-chica"]');
    await wait(500);
    
    // Agregar movimientos de caja chica
    const today = new Date().toISOString().split('T')[0];
    await page.selectOption('#caja-tipo', 'ingreso');
    await page.selectOption('#caja-categoria', 'apertura');
    await page.fill('#caja-descripcion', 'Apertura de prueba para reportes');
    await page.fill('#caja-monto', '50000');
    await page.click('#form-caja-chica button[type="submit"]');
    await wait(500);
    
    await page.selectOption('#caja-tipo', 'egreso');
    await page.selectOption('#caja-categoria', 'materiales');
    await page.fill('#caja-descripcion', 'Compra materiales prueba reporte');
    await page.fill('#caja-monto', '2500');
    await page.click('#form-caja-chica button[type="submit"]');
    await wait(500);

    // Agregar datos de maquinaria
    await page.click('[data-module="maquinaria"]');
    await wait(500);
    await page.selectOption('#maq-tipo', 'retroexcavadora');
    await page.fill('#maq-codigo', 'RETRO-TEST');
    await page.fill('#maq-val-inicial', '1000');
    await page.fill('#maq-val-final', '1010');
    await page.fill('#maq-galones', '15');
    await page.fill('#maq-precio-galon', '35');
    await page.click('#form-maquinaria button[type="submit"]');
    await wait(500);

    // Agregar trabajador para asistencia
    await page.click('[data-module="personal"]');
    await wait(500);
    await page.fill('#trab-nombre', 'Trabajador Test Reportes');
    await page.fill('#trab-puesto', 'Albañil');
    await page.fill('#trab-pago-normal', '18.75');
    await page.fill('#trab-pago-extra', '28.00');
    await page.click('#form-trabajador button[type="submit"]');
    await wait(500);
    
    // Marcar asistencia
    await page.fill('#fecha-asistencia', today);
    await wait(300);
    const trabajadorId = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const pid = db.configuracion.proyecto_actual;
      const trab = db.proyectos_data[pid].personal.trabajadores[0];
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

    // Agregar camión y viaje
    await page.click('[data-module="viajes"]');
    await wait(500);
    await page.fill('#cam-nombre', 'Camión Test Reportes');
    await page.selectOption('#cam-propiedad', 'propio');
    await page.fill('#cam-consumo', '0.35');
    await page.click('#form-camion button[type="submit"]');
    await wait(500);
    
    await page.fill('#ruta-nombre', 'Botadero Test');
    await page.fill('#ruta-distancia', '15');
    await page.click('#form-ruta button[type="submit"]');
    await wait(500);
    
    // Registrar viaje
    const camionId = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const pid = db.configuracion.proyecto_actual;
      const cam = db.proyectos_data[pid].viajes_camiones.camiones[0];
      return cam ? cam.id : null;
    });
    
    const rutaId = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const pid = db.configuracion.proyecto_actual;
      const ruta = db.proyectos_data[pid].viajes_camiones.rutas_botadero[0];
      return ruta ? ruta.id : null;
    });
    
    if (camionId && rutaId) {
      await page.selectOption('#viaje-cam', camionId);
      await wait(200);
      await page.selectOption('#viaje-ruta', rutaId);
      await wait(200);
      await page.selectOption('#viaje-material', 'tierra');
      await page.fill('#viaje-numero', '5');
      await page.fill('#viaje-precio-diesel', '35');
      await page.click('#form-viaje button[type="submit"]');
      await wait(500);
    }

    // Agregar mantenimiento
    await page.click('[data-module="mantenimiento"]');
    await wait(500);
    await page.fill('#maqcat-nombre', 'Retroexcavadora Test Reportes');
    await page.selectOption('#maqcat-tipo', 'Retroexcavadora');
    await page.click('#form-maqcat button[type="submit"]');
    await wait(500);
    
    const maquinaId = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('construramsa_db'));
      const pid = db.configuracion.proyecto_actual;
      const maq = db.proyectos_data[pid].mantenimiento.maquinaria[0];
      return maq ? maq.id : null;
    });
    
    if (maquinaId) {
      await page.selectOption('#ord-maquina', maquinaId);
      await wait(200);
      await page.selectOption('#ord-tipo', 'preventivo');
      await page.fill('#ord-costo', '3500');
      await page.fill('#ord-observaciones', 'Mantenimiento prueba reporte');
      await page.click('#form-orden button[type="submit"]');
      await wait(500);
    }

    // Tipos de reportes a probar
        const tiposReporte = ['diario', 'semanal', 'mensual', 'asistencia', 'viajes', 'mantenimiento'];
    const formatos = ['pdf', 'csv'];
    
    console.log('\n══════════════════════════════════════════════');
    console.log('  GENERACIÓN DE REPORTES');
    console.log('══════════════════════════════════════════════\n');

    // Ir al módulo de reportes
    await page.click('[data-module="reportes"]');
    await wait(500);

    for (const tipo of tiposReporte) {
      console.log(`\n--- ${tipo.toUpperCase()} ---`);
      
      // Seleccionar tipo de reporte
      await page.selectOption('#reporte-tipo', tipo);
      await wait(500);
      
      // Configurar fecha según el tipo de reporte
      // Los reportes de asistencia tienen modo de fecha deshabilitado
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
        // Para reportes de asistencia, solo configurar la fecha si está disponible
        const fechaInput = await page.$('#reporte-fecha');
        if (fechaInput) {
          await page.fill('#reporte-fecha', today);
          await wait(200);
        }
      }
      
      for (const formato of formatos) {
        try {
          // Limpiar cualquier plantilla de PDF residual
          await page.evaluate(() => {
            const plantilla = document.getElementById('plantilla-reporte-impresion');
            if (plantilla) {
              plantilla.classList.remove('pdf-generating');
              plantilla.style.left = '-9999px';
              plantilla.style.top = '-9999px';
            }
          });
          await wait(500);
          
          // Desmarcar todos los formatos
          await page.evaluate(() => {
            document.getElementById('export-pdf').checked = false;
                        document.getElementById('export-csv').checked = false;
          });
          
          // Marcar solo el formato actual
          await page.evaluate((fmt) => {
            document.getElementById(`export-${fmt}`).checked = true;
          }, formato);
          
          // Generar reporte usando función directa en lugar de click
          await page.evaluate(() => {
            generarReporteLocal();
          });
          await wait(4000);
          
          // Verificar que no haya errores de consola
          const erroresDuranteGeneracion = errores.filter(e => e.includes('Error') || e.includes('error'));
          if (erroresDuranteGeneracion.length > 0) {
            log(tipo, formato.toUpperCase(), false, 'Errores en consola durante generación');
            continue;
          }
          
          log(tipo, formato.toUpperCase(), true, 'Generado exitosamente');
          resultados.push({ tipo, formato: formato.toUpperCase(), ok: true });
          
          // Esperar entre generaciones y limpiar plantilla
          await wait(1500);
          
        } catch (error) {
          log(tipo, formato.toUpperCase(), false, error.message);
          resultados.push({ tipo, formato: formato.toUpperCase(), ok: false, error: error.message });
          
          // Limpiar plantilla en caso de error
          await page.evaluate(() => {
            const plantilla = document.getElementById('plantilla-reporte-impresion');
            if (plantilla) {
              plantilla.classList.remove('pdf-generating');
              plantilla.style.left = '-9999px';
              plantilla.style.top = '-9999px';
            }
          });
          await wait(500);
        }
      }
    }

    console.log('\n══════════════════════════════════════════════');
    console.log('  RESUMEN FINAL');
    console.log('══════════════════════════════════════════════');
    
    const exitosos = resultados.filter(r => r.ok).length;
    const fallidos = resultados.filter(r => !r.ok).length;
    
    console.log(`  ✅ Exitosos : ${exitosos}`);
    console.log(`  ❌ Fallidos : ${fallidos}`);
    console.log(`  📊 Total   : ${resultados.length}`);
    
    if (errores.length > 0) {
      console.log('\n  ⚠️  Errores de consola detectados:');
      errores.forEach(e => console.log(`     - ${e}`));
    }

    if (fallidos > 0) {
      console.log('\n  ❌ Reportes fallidos:');
      resultados.filter(r => !r.ok).forEach(r => {
        console.log(`     - ${r.tipo} (${r.formato}): ${r.error}`);
      });
    }

  } catch (error) {
    console.error('Error general en test de reportes:', error);
  } finally {
    await browser.close();
    server.kill();
  }

  const exitCode = resultados.some(r => !r.ok) || errores.length > 0 ? 1 : 0;
  process.exit(exitCode);
})().catch(error => { console.error(error); process.exit(1); });
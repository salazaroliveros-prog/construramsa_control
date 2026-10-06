/**
 * CONSTRURAMSA — Prueba de Paginación con Muchos Registros v2.9.4
 * ====================================================================
 * Verifica que con cientos de registros la paginación (módulo Maquinaria)
 * genera las páginas correctas y que los BOTONES DE DIRECCIÓN navegan a
 * cada página correctamente:
 *   - ◀ "Página anterior"  y  ▶ "Página siguiente"
 *   - Estado habilitado/deshabilitado en los extremos
 *   - Contenido distinto por página y estable al regresar
 *
 * Cobertura:
 *   - 105 registros -> 6 páginas  (última página con 5 filas)
 *   - 250 registros -> 13 páginas (última página con 10 filas)
 *   - Recorrido completo ◀/▶ hacia adelante y hacia atrás, página por página
 *
 * Ejecución:  npm run test-paginacion   (node test_paginacion_registros.js)
 */

'use strict';

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Puerto propio para no colisionar con otros tests (e2e:8145, validacion:3000)
const PORT = process.env.PORT || '8146';
const BASE = `http://127.0.0.1:${PORT}/`;
const TIMEOUT = 20000;
const POR_PAGINA = 20;
const REPORT = path.join(__dirname, 'paginacion_report.json');

// ====== Helpers ======
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function esperarServidor(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const limite = Date.now() + timeoutMs;
    const intentar = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode < 500) return resolve();
        reintentar();
      });
      req.on('error', reintentar);
      req.setTimeout(1000, () => {
        req.destroy();
        reintentar();
      });
    };
    const reintentar = () => {
      if (Date.now() >= limite) return reject(new Error('Servidor no disponible'));
      setTimeout(intentar, 200);
    };
    intentar();
  });
}

async function waitApp(page) {
  await page.waitForFunction(() => typeof APP_VERSION !== 'undefined', null, { timeout: TIMEOUT });
}

/**
 * Espera a que la app esté inicializada Y el documento esté estable: la PWA
 * encadena recargas automáticas (service worker con skipWaiting+claim y la
 * carga del seed construramsa_db.json), que dejan ventanas donde el contexto
 * de ejecución aún no existe o está a punto de recargarse. Se valida la edad
 * del documento (performance.now()) para descartar recargas recientes.
 */
async function esperarAppListo(page, edadMinimaMs = 3000) {
  const limite = Date.now() + TIMEOUT * 2;
  for (;;) {
    let listo = false;
    try {
      const estado = await page.evaluate(
        (min) => ({
          listo:
            typeof getDB === 'function' &&
            typeof saveDB === 'function' &&
            typeof estadoPaginacion !== 'undefined' &&
            typeof cargarTablaMaquinaria === 'function' &&
            !!localStorage.getItem('construramsa_db') &&
            performance.now() > min,
        }),
        edadMinimaMs
      );
      listo = estado.listo;
    } catch (_) {
      // Contexto destruido por una recarga en curso: se reintenta
    }
    if (listo) return;
    if (Date.now() > limite) throw new Error('La app no se estabilizó (recargas encadenadas)');
    await sleep(500);
  }
}

/**
 * Prepara la tabla de maquinaria con `total` registros de forma robusta frente
 * a las recargas automáticas: espera estabilidad, inyecta (persistiendo vía
 * saveDB), absorbe recargas pendientes y garantiza el render final.
 */
async function prepararRegistros(page, total) {
  await esperarAppListo(page);
  await inyectarRegistros(page, total);
  // Ventana para absorber recargas pendientes del SW (los datos ya persisten
  // vía saveDB, así que una recarga conserva los registros inyectados)
  await sleep(2500);
  await esperarAppListo(page, 1500);
  const fin = await page.evaluate((esperado) => {
    const db = typeof getDB === 'function' ? getDB() : JSON.parse(localStorage.getItem('construramsa_db') || '{}');
    const pid = db.configuracion && db.configuracion.proyecto_actual;
    const d = (pid && db.proyectos_data && db.proyectos_data[pid]) || db;
    const n = (d.maquinaria_flota && d.maquinaria_flota.registros && d.maquinaria_flota.registros.length) || 0;
    if (n !== esperado) return n;
    // Asegura página 1 + render con los datos actuales
    estadoPaginacion.maquinaria = 1;
    cargarTablaMaquinaria();
    return n;
  }, total);
  if (fin !== total) {
    throw new Error(`Preparación incompleta: ${fin} de ${total} registros`);
  }
}


/** Espera a que el texto de paginación indique exactamente "Página <p> de <t>". */
function esperarPagina(page, pagina, total) {
  const fuente = `Página ${pagina} de ${total}(?!\\d)`;
  return page.waitForFunction(
    (patron) => {
      const el = document.getElementById('paginacion-maquinaria');
      return el ? new RegExp(patron).test(el.textContent) : false;
    },
    fuente,
    { timeout: TIMEOUT }
  );
}

function textoPaginacion(page) {
  return page.locator('#paginacion-maquinaria').innerText();
}

function cuentaFilas(page) {
  return page.locator('#tabla-maquinaria-cuerpo tr').count();
}

function primeraFecha(page) {
  return page.locator('#tabla-maquinaria-cuerpo tr td[data-label="Fecha"]').first().innerText();
}

function btnAnterior(page) {
  return page.locator('#paginacion-maquinaria button[aria-label="Página anterior"]');
}

function btnSiguiente(page) {
  return page.locator('#paginacion-maquinaria button[aria-label="Página siguiente"]');
}

/**
 * Inyecta N registros de maquinaria en la estructura real de la app y
 * fuerza el re-render de la tabla. Usa getDB()/saveDB() (no solo
 * localStorage) porque la app mantiene una caché en memoria (_dbCache) y
 * una hidratación asíncrona desde IndexedDB que, de hacerse después,
 * revertiría una escritura directa a localStorage. Tras inyectar verifica
 * que los registros persistan (reintenta si la hidratación los pisa).
 */
async function inyectarRegistros(page, total) {
  const intentar = () =>
    page.evaluate((n) => {
      const db =
        typeof getDB === 'function'
          ? getDB()
          : JSON.parse(localStorage.getItem('construramsa_db') || '{}');
      const pid = db.configuracion && db.configuracion.proyecto_actual;
      const destino = (pid && db.proyectos_data && db.proyectos_data[pid]) || db;
      if (!destino.maquinaria_flota || typeof destino.maquinaria_flota !== 'object') {
        destino.maquinaria_flota = { vehiculos: [], registros: [] };
      }
      if (!Array.isArray(destino.maquinaria_flota.vehiculos)) {
        destino.maquinaria_flota.vehiculos = [];
      }
      const vehiculos = destino.maquinaria_flota.vehiculos;
      const vehiculoId = vehiculos.length ? vehiculos[0].id : null;

      const registros = [];
      for (let i = 1; i <= n; i++) {
        registros.push({
          id: 'pag_test_' + i,
          // Fecha ISO distinta por registro: la tabla ordena desc por fecha
          fecha: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10),
          vehiculo_id: vehiculoId,
          odometro_inicial: 500,
          odometro_final: 500 + i,
          combustible_galones: 10,
          combustible_costo: 100,
          mantenimiento_costo: 50,
        });
      }
      destino.maquinaria_flota.registros = registros;
      // saveDB actualiza _dbCache + localStorage (+ espejo de persistencia)
      if (typeof saveDB === 'function') saveDB(db);
      else localStorage.setItem('construramsa_db', JSON.stringify(db));

      // Re-render sin navegar: vuelve a la página 1 y repinta la tabla
      estadoPaginacion.maquinaria = 1;
      cargarTablaMaquinaria();

      const filas = document.querySelectorAll('#tabla-maquinaria-cuerpo tr').length;
      const pag = document.getElementById('paginacion-maquinaria');
      return { regs: registros.length, filas, pagText: pag ? pag.textContent : '' };
    }, total);

  let diag = await intentar();
  // Deja pasar la hidratación asíncrona (IndexedDB) y confirma persistencia
  for (let reintento = 0; reintento < 4 && diag.regs !== total; reintento++) {
    await sleep(700);
    diag = await intentar();
  }
  if (diag.regs !== total) {
    throw new Error(`La inyección no persistió: se esperaban ${total} registros y hay ${diag.regs}`);
  }
  // Ventana extra por si la hidratación llega tarde
  await sleep(700);
  const confirmado = await page.evaluate((esperado) => {
    const db =
      typeof getDB === 'function'
        ? getDB()
        : JSON.parse(localStorage.getItem('construramsa_db') || '{}');
    const pid = db.configuracion && db.configuracion.proyecto_actual;
    const d = (pid && db.proyectos_data && db.proyectos_data[pid]) || db;
    const n = (d.maquinaria_flota && d.maquinaria_flota.registros && d.maquinaria_flota.registros.length) || 0;
    if (n !== esperado) {
      estadoPaginacion.maquinaria = 1;
      cargarTablaMaquinaria();
    }
    return n;
  }, total);
  if (confirmado !== total) {
    throw new Error(`Los registros fueron revertidos: ${confirmado} de ${total}`);
  }
  return diag;
}


// ====== Suite ======
const resultados = [];
function check(nombre, cond) {
  const ok = !!cond;
  resultados.push({ nombre, pasa: ok });
  console.log(`  ${ok ? 'OK ' : 'KO '} ${nombre}`);
  return ok;
}

async function main() {
  console.log(`\n=== PRUEBA DE PAGINACIÓN — ${BASE} ===\n`);

  const servidor = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT), NODE_OPTIONS: '' },
    stdio: 'ignore',
  });

  let browser;
  try {
    await esperarServidor(BASE);
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // ---------- ESCENARIO A: 105 registros → 6 páginas ----------
    console.log('--- Escenario A: 105 registros (6 páginas) ---');
    await page.goto(`${BASE}?module=maquinaria`, { waitUntil: 'networkidle' });
    await prepararRegistros(page, 105);

    await esperarPagina(page, 1, 6);
    const textoA1 = await textoPaginacion(page);
    check(
      'A1: indica "Página 1 de 6 (105 registros)"',
      /Página 1 de 6 \(105 registros\)/.test(textoA1)
    );

    const filasA1 = await cuentaFilas(page);
    check('A2: página 1 muestra 20 filas', filasA1 === POR_PAGINA);
    check('A3: botón ◀ deshabilitado en página 1', await btnAnterior(page).isDisabled());
    check('A4: botón ▶ habilitado en página 1', !(await btnSiguiente(page).isDisabled()));

    const fechaA1 = await primeraFecha(page);

    // ▶ → página 2
    await btnSiguiente(page).click();
    await esperarPagina(page, 2, 6);
    check('A5: ▶ avanza a página 2 (20 filas)', (await cuentaFilas(page)) === POR_PAGINA);
    const fechaA2 = await primeraFecha(page);
    check('A6: página 2 muestra registros distintos a página 1', fechaA2 !== fechaA1);

    // ◀ → página 1 (misma data que al inicio)
    await btnAnterior(page).click();
    await esperarPagina(page, 1, 6);
    check('A7: ◀ regresa a página 1 con las mismas filas', (await primeraFecha(page)) === fechaA1);

    // Recorrido completo ◀/▶ hacia la última página
    let recorridoOk = true;
    for (let p = 2; p <= 6; p++) {
      await btnSiguiente(page).click();
      try {
        await esperarPagina(page, p, 6);
      } catch (_) {
        recorridoOk = false;
        break;
      }
      const filas = await cuentaFilas(page);
      const esperadas = p < 6 ? POR_PAGINA : 5; // 105 = 5*20 + 5
      if (filas !== esperadas) {
        recorridoOk = false;
        break;
      }
    }
    check('A8: ▶ recorre las 6 páginas con el nº correcto de filas', recorridoOk);

    check('A9: ▶ deshabilitado en última página', await btnSiguiente(page).isDisabled());
    check('A10: ◀ habilitado en última página', !(await btnAnterior(page).isDisabled()));
    const textoFin = await textoPaginacion(page);
    check(
      'A11: última página es "Página 6 de 6"',
      /Página 6 de 6 \(105 registros\)/.test(textoFin)
    );

    // Intento de avanzar más allá de la última página (botón deshabilitado)
    await btnSiguiente(page).click({ force: true }).catch(() => {});
    await sleep(300);
    const textoTrasIntento = await textoPaginacion(page);
    check('A12: no avanza más allá de la última página', /Página 6 de 6/.test(textoTrasIntento));

    // ◀ de vuelta a página 5
    await btnAnterior(page).click();
    await esperarPagina(page, 5, 6);
    check('A13: ◀ desde última página llega a página 5', (await cuentaFilas(page)) === POR_PAGINA);

    // ---------- ESCENARIO B: 250 registros → 13 páginas ----------
    // Misma sesión (sin recargar): reinyecta y re-renderiza a página 1
    console.log('\n--- Escenario B: 250 registros (13 páginas) ---');
    await prepararRegistros(page, 250);

    await esperarPagina(page, 1, 13);
    const textoB1 = await textoPaginacion(page);
    check(
      'B1: indica "Página 1 de 13 (250 registros)"',
      /Página 1 de 13 \(250 registros\)/.test(textoB1)
    );
    check('B2: página 1 muestra 20 filas', (await cuentaFilas(page)) === POR_PAGINA);
    const fechaB1 = await primeraFecha(page);

    // Recorrido completo hacia adelante (13 páginas)
    let adelanteOk = true;
    for (let p = 2; p <= 13; p++) {
      await btnSiguiente(page).click();
      try {
        await esperarPagina(page, p, 13);
      } catch (_) {
        adelanteOk = false;
        break;
      }
      const filas = await cuentaFilas(page);
      const esperadas = p < 13 ? POR_PAGINA : 10; // 250 = 12*20 + 10
      if (filas !== esperadas) {
        adelanteOk = false;
        break;
      }
    }
    check('B3: ▶ recorre las 13 páginas con el nº correcto de filas', adelanteOk);
    check('B4: ▶ deshabilitado en página 13', await btnSiguiente(page).isDisabled());

    // Recorrido completo hacia atrás (13 → 1)
    let atrasOk = true;
    for (let p = 12; p >= 1; p--) {
      await btnAnterior(page).click();
      try {
        await esperarPagina(page, p, 13);
      } catch (_) {
        atrasOk = false;
        break;
      }
      if ((await cuentaFilas(page)) !== POR_PAGINA) {
        atrasOk = false;
        break;
      }
    }
    check('B5: ◀ recorre de vuelta las 13 páginas con 20 filas', atrasOk);
    check('B6: ◀ deshabilitado al volver a página 1', await btnAnterior(page).isDisabled());
    check('B7: ida y vuelta restaura la primera fila original', (await primeraFecha(page)) === fechaB1);

    // ---------- Resumen ----------
    const pasados = resultados.filter((r) => r.pasa).length;
    const total = resultados.length;
    console.log('\n=== RESUMEN DE PRUEBAS DE PAGINACIÓN ===');
    resultados.forEach((r) => console.log(`  ${r.pasa ? 'OK ' : 'KO '} ${r.nombre}`));
    console.log(`\nTotal: ${pasados}/${total} pasaron`);

    fs.writeFileSync(
      REPORT,
      JSON.stringify(
        { base: BASE, fin: new Date().toISOString(), total, pasados, resultados },
        null,
        2
      )
    );

    return pasados === total ? 0 : 1;
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    resultados.push({ nombre: 'Error de ejecución: ' + (err && err.message), pasa: false });
    console.log(`\nTotal: 0/${resultados.length} pasaron`);
    try {
      fs.writeFileSync(
        REPORT,
        JSON.stringify({ base: BASE, fin: new Date().toISOString(), resultados }, null, 2)
      );
    } catch (_) {
      /* reporte opcional */
    }
    return 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    servidor.kill();
  }
}

main().then((codigo) => {
  // Salida explícita: si quedaran handles abiertos (sockets, servidor), no debe colgarse.
  process.exit(codigo);
});

